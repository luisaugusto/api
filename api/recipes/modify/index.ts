import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  buildModificationPrompt,
  extractIds,
  extractModificationRequest,
  hasModifyTag,
  validateWebhookPayload,
} from "../../../lib/recipes/modify/helpers.js";
import {
  buildRecipeNotionProperties,
  fetchComment,
  fetchPage,
  postComment,
  updatePage,
  verifyDatabaseAccess,
} from "../../../lib/shared/notion.js";
import Recipe from "../../../lib/recipes/schema.js";
import { convertNotionPropertiesToRecipe } from "../../../lib/shared/recipes.js";
import { generateData } from "../../../lib/shared/openai.js";
import { waitUntil } from "@vercel/functions";
import { zodTextFormat } from "openai/helpers/zod";

const format = zodTextFormat(Recipe, "recipe");

const updateRecipeAndComment = async (
  pageId: string,
  currentRecipe: Partial<typeof format.__output>,
  modificationRequest: string,
): Promise<void> => {
  const modificationPrompt = buildModificationPrompt(
    currentRecipe,
    modificationRequest,
  );

  const updatedRecipe = await generateData({
    format,
    input: modificationRequest,
    instructions: modificationPrompt,
  });

  if (!updatedRecipe) {
    throw new Error("Failed to generate updated recipe");
  }

  const notionProperties = buildRecipeNotionProperties(updatedRecipe);
  await updatePage(
    pageId,
    notionProperties as Parameters<typeof updatePage>[1],
  );

  const summaryMessage =
    updatedRecipe.changeDescription ??
    "Recipe has been updated based on your suggestion";
  await postComment(pageId, summaryMessage);
};

const processRecipeModification = async (
  pageId: string,
  commentId: string,
  databaseId: string,
): Promise<void> => {
  const commentText = await fetchComment(commentId);

  if (!hasModifyTag(commentText)) {
    return;
  }

  const hasAccess = await verifyDatabaseAccess(pageId, databaseId);
  if (!hasAccess) {
    throw new Error("Page is not in the recipes database");
  }

  const pageProperties = await fetchPage(pageId);
  const currentRecipe = convertNotionPropertiesToRecipe(pageProperties);
  const modificationRequest = extractModificationRequest(commentText);

  await updateRecipeAndComment(pageId, currentRecipe, modificationRequest);
};

const validateRequest = (
  req: VercelRequest,
): { commentId: string; databaseId: string; pageId: string } | null => {
  if (!validateWebhookPayload(req.body)) {
    return null;
  }

  const { pageId, commentId } = extractIds(req.body);
  const databaseId = process.env.NOTION_RECIPES_DATABASE_ID;

  if (!databaseId) {
    return null;
  }

  return { commentId, databaseId, pageId };
};

const sendErrorResponse = (
  res: VercelResponse,
  error: unknown,
  message: string,
): void => {
  res.status(500).json({
    detail: String(error),
    error: message,
  });
};

const handleInvalidRequest = (
  res: VercelResponse,
  validated: { commentId: string; databaseId: string; pageId: string } | null,
): boolean => {
  if (!validated) {
    res.status(400).json({ error: "Invalid webhook payload" });
    return true;
  }
  if (!validated.databaseId) {
    res.status(500).json({
      error: "NOTION_RECIPES_DATABASE_ID not configured",
    });
    return true;
  }
  return false;
};

export default function handler(req: VercelRequest, res: VercelResponse): void {
  try {
    const validated = validateRequest(req);
    if (handleInvalidRequest(res, validated)) {
      return;
    }

    if (!validated) {
      return;
    }

    const { pageId, commentId, databaseId } = validated;

    waitUntil(
      processRecipeModification(pageId, commentId, databaseId).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Recipe modification failed:", String(err));
      }),
    );

    res.status(200).json({ message: "Recipe modification in progress" });
  } catch (error) {
    sendErrorResponse(res, error, "Failed to process webhook");
  }
}
