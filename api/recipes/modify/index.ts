import {
  NotionWebhookPayload,
  buildModificationPrompt,
  extractModificationRequest,
} from "../../../lib/recipes/modify/helpers.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  buildBodyBlocks,
  buildRecipeNotionProperties,
  convertNotionPropertiesToRecipe,
  generateRecipeImage,
} from "../../../lib/shared/recipes.js";
import {
  fetchComment,
  fetchPageBlocks,
  postComment,
  updatePage,
  updatePageBlocks,
  verifyDatabaseAccess,
} from "../../../lib/shared/notion.js";
import Recipe from "../../../lib/recipes/schema.js";
import { generateData } from "../../../lib/shared/openai.js";
import { setResponse } from "../../../lib/shared/utils.js";
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
  notionProperties.Name = {
    title: [{ text: { content: updatedRecipe.title } }],
  };

  const cover = await generateRecipeImage(updatedRecipe);

  await updatePage(pageId, cover, notionProperties);

  const bodyBlocks = buildBodyBlocks(updatedRecipe);
  await updatePageBlocks(pageId, bodyBlocks);

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

  if (commentText.includes("#modify") === false) {
    return;
  }

  const page = await verifyDatabaseAccess(pageId, databaseId);
  if (!page) {
    throw new Error("Page is not found in the database");
  }

  const blockContent = await fetchPageBlocks(pageId);
  const currentRecipe = convertNotionPropertiesToRecipe(
    page.properties,
    blockContent,
  );
  const modificationRequest = extractModificationRequest(commentText);

  await updateRecipeAndComment(pageId, currentRecipe, modificationRequest);
};

export default function handler(req: VercelRequest, res: VercelResponse): void {
  try {
    const body = req.body as NotionWebhookPayload;
    if (body.type !== "comment_created") {
      setResponse({
        error: null,
        message: "Ignoring non-comment_created event",
        res,
        status: 200,
      });
      return;
    }

    waitUntil(
      processRecipeModification(
        body.data.page_id,
        body.entity.id,
        body.data.parent.id,
      ),
    );

    res.status(200).json({ message: "Recipe modification in progress" });
  } catch (error) {
    setResponse({
      error,
      message: "Failed to process webhook",
      res,
      status: 500,
    });
  }
}
