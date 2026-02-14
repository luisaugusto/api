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
import {
  buildRecipeNotionProperties,
} from "../../lib/shared/recipes.js";
import { markdownToBlocks, markdownToRichText } from "@tryfabric/martian";
import { setResponse, verifyParam } from "../../lib/shared/utils.js";
import type { CreatePageParameters } from "@notionhq/client";
import Recipe from "../../lib/recipes/schema.js";
import { generateDataAndImageBatch } from "../../lib/shared/openai.js";
import { waitUntil } from "@vercel/functions";
import { zodTextFormat } from "openai/helpers/zod";

const format = zodTextFormat(Recipe, "recipe");

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

export default function handler(req: VercelRequest, res: VercelResponse): void {
  try {
    const db = verifyParam(
      res,
      req.query.db,
      "Missing required query param: db",
    );
    const prompt = verifyParam(
      res,
      req.query.prompt,
      "Missing required query param: prompt",
    );

    waitUntil(
      generateDataAndImageBatch({
        format,
        input: prompt,
        instructions:
          "You are a helpful assistant that provides detailed cooking recipes based on user prompts. All the instructions and details should be should be clear, concise, and easy to follow.",
      }).then(async ({ data: recipe, imageB64 }) => {
        const fileUploadId = await uploadImageToNotion(imageB64, recipe.title);
        const cover = {
          file_upload: { id: fileUploadId },
          type: "file_upload" as const,
        };
        return createRecipe(recipe, cover, db);
      }),
    );

    res.status(200).json("Recipe creation in progress");
  } catch (error) {
    setResponse({
      error,
      message: "Failed to create recipe",
      res,
      status: 500,
    });
  }
}
