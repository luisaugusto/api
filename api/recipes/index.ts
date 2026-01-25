import type {
  Block,
  RichText,
} from "@tryfabric/martian/build/src/notion/blocks.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  addCommentToNotionPage,
  convertToBlockObjectRequest,
  createNotionPage,
  uploadImageToNotion,
} from "../../lib/shared/notion.js";
import { generateData, generateImage } from "../../lib/shared/openai.js";
import { markdownToBlocks, markdownToRichText } from "@tryfabric/martian";
import type { CreatePageParameters } from "@notionhq/client";
import Recipe from "../../lib/recipes/schema.js";
import { buildRecipeNotionProperties } from "../../lib/shared/recipes.js";
import { waitUntil } from "@vercel/functions";
import { zodTextFormat } from "openai/helpers/zod";

const format = zodTextFormat(Recipe, "recipe");

const buildImagePrompt = (recipe: typeof format.__output): string => {
  const ingredientList = recipe.ingredients
    .map((ing) => `${ing.ingredient} (${ing.quantity})`)
    .join(", ");
  return [
    `A high-quality, cinematic food photograph of "${recipe.title}"`,
    recipe.description,
    `Key ingredients: ${ingredientList}.`,
    "Style: natural light, shallow depth of field, vibrant colors, soft shadows, no text, no labels, no people, professional food styling.",
  ].join("\n");
};

const buildIngredientsRichText = (recipe: typeof format.__output): RichText[] =>
  markdownToRichText(
    recipe.ingredients
      .map(
        (ingredient) => `**${ingredient.ingredient}** - ${ingredient.quantity}`,
      )
      .join("\n"),
  );

const buildNutritionRichText = (recipe: typeof format.__output): RichText[] =>
  markdownToRichText(
    recipe.otherNutrition
      .map((item) => `**${item.item}** - ${item.quantity}`)
      .join("\n"),
  );

const buildBodyBlocks = (recipe: typeof format.__output): Block[] =>
  markdownToBlocks(`# Preparation
${recipe.preparation.map((step, index) => `${index + 1}. ${step}`).join("\n")}
# Instructions
${recipe.instructions
  .map((step, index) => `${index + 1}. ${step}`)
  .join("\n")}`);

const buildInformation = (
  recipe: typeof format.__output,
): {
  blocks: Block[];
  ingredientsRT: RichText[];
  nutritionRT: RichText[];
} => ({
  blocks: buildBodyBlocks(recipe),
  ingredientsRT: buildIngredientsRichText(recipe),
  nutritionRT: buildNutritionRichText(recipe),
});

const createRecipe = async (
  recipe: typeof format.__output,
  cover: CreatePageParameters["cover"],
  database_id: string,
): Promise<void> => {
  const { blocks, ingredientsRT, nutritionRT } = buildInformation(recipe);
  const recipeProperties = buildRecipeNotionProperties(recipe);
  const pageId = await createNotionPage({
    children: convertToBlockObjectRequest(blocks),
    cover: cover ?? null,
    database_id,
    properties: {
      ...recipeProperties,
      Ingredients: { rich_text: ingredientsRT },
      Name: { title: [{ text: { content: recipe.title } }] },
      "Nutrition Facts": { rich_text: nutritionRT },
    },
  });
  await addCommentToNotionPage({
    message: "your recipe has been created!",
    pageId,
  });
};

const validateParams = (
  database_id: unknown,
  prompt: unknown,
): { database_id: string; prompt: string } | { error: string } => {
  if (!database_id) {
    return { error: "Missing required query param: db (Notion database ID)" };
  }
  if (!prompt) {
    return { error: "Missing required query param: prompt" };
  }
  return { database_id: String(database_id), prompt: String(prompt) };
};

const generateRecipeWithImage = async (
  prompt: string,
): Promise<{
  cover: CreatePageParameters["cover"];
  recipe: typeof format.__output;
}> => {
  const recipe = await generateData({
    format,
    input: prompt,
    instructions:
      "You are a helpful assistant that provides detailed cooking recipes based on user prompts. All the instructions and details should be should be clear, concise, and easy to follow.",
  });

  if (!recipe) {
    throw new Error("No recipe generated");
  }

  const imagePrompt = buildImagePrompt(recipe);
  const b64 = await generateImage(imagePrompt);
  const fileUploadId = await uploadImageToNotion(b64, recipe.title);
  const cover: CreatePageParameters["cover"] = {
    file_upload: { id: fileUploadId },
    type: "file_upload",
  };
  return { cover, recipe };
};

export default function handler(req: VercelRequest, res: VercelResponse): void {
  try {
    const validation = validateParams(req.query.db, req.query.prompt);

    if ("error" in validation) {
      res.status(400).json({ error: validation.error });
      return;
    }

    waitUntil(
      generateRecipeWithImage(validation.prompt).then(({ cover, recipe }) =>
        createRecipe(recipe, cover, validation.database_id),
      ),
    );

    res.status(200).json("Recipe creation in progress.");
  } catch (error) {
    res.status(500).json({
      detail: String(error),
      error: "Failed to create recipe",
    });
  }
}
