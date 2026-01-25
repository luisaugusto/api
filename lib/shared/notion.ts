import {
  type BlockObjectRequest,
  Client,
  type CreatePageParameters,
} from "@notionhq/client";
import type { Block } from "@tryfabric/martian/build/src/notion/blocks.js";
import { slugify } from "./utils.js";
import undici from "undici";

const { FormData } = undici;

export const getNotionClient = (): Client =>
  new Client({ auth: String(process.env.NOTION_TOKEN) });

// Need to find a way to ensure type safety here
// There's a mismatch between the Block type from Martian and the BlockObjectRequest type from Notion SDK
// Due to the version mismatch of the Notion API
export const convertToBlockObjectRequest = (
  blocks: Block[],
): BlockObjectRequest[] => blocks as BlockObjectRequest[];

const createFileUpload = async (
  notion: Client,
  filename: string,
): Promise<{ id: string }> => {
  const created = await notion.fileUploads.create({
    content_type: "image/png",
    filename,
  });
  return created;
};

const uploadFileToNotion = async (
  fileUploadId: string,
  imageBuffer: Buffer,
  filename: string,
): Promise<void> => {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }),
    filename,
  );

  const res = await fetch(
    `https://api.notion.com/v1/file_uploads/${fileUploadId}/send`,
    {
      body: form,
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
      },
      method: "POST",
    },
  );
  if (!res.ok) {
    throw new Error(await res.text());
  }
};

export const uploadImageToNotion = async (
  b64: string,
  title: string,
): Promise<string> => {
  try {
    const notion = getNotionClient();
    const imageBuffer = Buffer.from(b64, "base64");
    const filename = `${Date.now()}-${slugify(title) || "recipe"}.png`;
    const created = await createFileUpload(notion, filename);
    await uploadFileToNotion(created.id, imageBuffer, filename);
    return created.id;
  } catch (err) {
    throw new Error(`Failed to upload image to Notion`, { cause: err });
  }
};

export const createNotionPage = async ({
  children,
  database_id,
  properties,
  cover,
}: {
  database_id: string;
  children: BlockObjectRequest[];
  properties: NonNullable<
    Parameters<typeof Client.prototype.pages.create>[0]["properties"]
  >;
  cover?: CreatePageParameters["cover"];
}): Promise<string> => {
  try {
    const notion = getNotionClient();
    const created = await notion.pages.create({
      children,
      cover: cover ?? null,
      parent: { database_id },
      properties,
    });
    return created.id;
  } catch (err) {
    throw new Error(`Failed to create Notion page`, { cause: err });
  }
};

export const addCommentToNotionPage = async ({
  pageId,
  message,
}: {
  pageId: string;
  message: string;
}): Promise<void> => {
  const userId = process.env.NOTION_USER_ID;
  if (userId === undefined) {
    throw new Error("NOTION_USER_ID is not defined in environment variables");
  }

  try {
    const notion = getNotionClient();
    await notion.comments.create({
      parent: { page_id: pageId },
      rich_text: [
        { text: { content: "Hey " }, type: "text" },
        {
          mention: { type: "user", user: { id: userId } },
          type: "mention",
        },
        { text: { content: `, ${message}` }, type: "text" },
      ],
    });
  } catch (err) {
    throw new Error(`Failed to add Notion comment`, { cause: err });
  }
};

// Generic helpers for reuse across features

export const fetchPage = async (
  pageId: string,
): Promise<Record<string, unknown>> => {
  try {
    const notion = getNotionClient();
    const page = await notion.pages.retrieve({ page_id: pageId });
    return (page as Record<string, unknown>).properties as Record<
      string,
      unknown
    >;
  } catch (err) {
    throw new Error(`Failed to fetch Notion page`, { cause: err });
  }
};

export const updatePage = async (
  pageId: string,
  properties: NonNullable<
    Parameters<typeof Client.prototype.pages.update>[0]["properties"]
  >,
): Promise<void> => {
  try {
    const notion = getNotionClient();
    await notion.pages.update({ page_id: pageId, properties });
  } catch (err) {
    throw new Error(`Failed to update Notion page`, { cause: err });
  }
};

export const fetchComment = async (commentId: string): Promise<string> => {
  try {
    const notion = getNotionClient();
    const comment = await notion.comments.retrieve({ comment_id: commentId });
    const commentData = comment as Record<string, unknown>;

    // Extract plain text from rich_text array
    const textContent = (
      (commentData.rich_text as {
        type: string;
        text?: { content: string };
        mention?: unknown;
      }[]) || []
    )
      .filter((rt) => rt.type === "text" && rt.text)
      .map((rt) => rt.text?.content)
      .join("");

    return textContent;
  } catch (err) {
    throw new Error(`Failed to fetch Notion comment`, { cause: err });
  }
};

export const postComment = async (
  pageId: string,
  message: string,
): Promise<void> => {
  try {
    const notion = getNotionClient();
    await notion.comments.create({
      parent: { page_id: pageId },
      rich_text: [{ text: { content: message }, type: "text" }],
    });
  } catch (err) {
    throw new Error(`Failed to post Notion comment`, { cause: err });
  }
};

export const verifyDatabaseAccess = async (
  pageId: string,
  expectedDatabaseId: string,
): Promise<boolean> => {
  try {
    const notion = getNotionClient();
    const page = await notion.pages.retrieve({ page_id: pageId });
    const pageData = page as Record<string, unknown>;

    const pageDatabase = ((pageData.parent as { database_id?: string }) || {})
      .database_id;
    return pageDatabase === expectedDatabaseId;
  } catch (err) {
    throw new Error(`Failed to verify database access`, { cause: err });
  }
};

interface RecipeInput {
  allergies: string[];
  calories: number;
  carbs: number;
  cookTime: number;
  country: string;
  description: string;
  diet: string[];
  difficulty: string;
  fat: number;
  fiber: number;
  ingredients: { ingredient: string; quantity: string }[];
  mealType: string[];
  otherNutrition: { item: string; quantity: string }[];
  prepTime: number;
  protein: number;
  proteinType: string[];
  servingSize: string;
  title: string;
}

const buildIngredientsList = (
  ingredients: { ingredient: string; quantity: string }[],
): Record<string, unknown> => ({
  rich_text: ingredients.map((ing) => ({
    text: { content: `**${ing.ingredient}** - ${ing.quantity}` },
    type: "text",
  })),
});

const buildNutritionList = (
  otherNutrition: { item: string; quantity: string }[],
): Record<string, unknown> => ({
  rich_text: otherNutrition.map((item) => ({
    text: { content: `**${item.item}** - ${item.quantity}` },
    type: "text",
  })),
});

// Build Notion page properties from recipe data
export const buildRecipeNotionProperties = (
  recipe: RecipeInput,
): Record<string, unknown> => ({
  Allergies: {
    multi_select: recipe.allergies.map((allergy) => ({ name: allergy })),
  },
  "Calories (cal)": { number: recipe.calories },
  "Carbs (g)": { number: recipe.carbs },
  "Cook Time (min)": { number: recipe.cookTime },
  "Country of Origin": { select: { name: recipe.country } },
  Description: {
    rich_text: [{ text: { content: recipe.description } }],
  },
  Diet: { multi_select: recipe.diet.map((item) => ({ name: item })) },
  Difficulty: { select: { name: recipe.difficulty } },
  "Fat (g)": { number: recipe.fat },
  "Fiber (g)": { number: recipe.fiber },
  Ingredients: buildIngredientsList(recipe.ingredients),
  "Meal Type": {
    multi_select: recipe.mealType.map((type) => ({ name: type })),
  },
  "Nutrition Facts": buildNutritionList(recipe.otherNutrition),
  "Prep Time (min)": { number: recipe.prepTime },
  "Protein (g)": { number: recipe.protein },
  "Protein Type": {
    multi_select: recipe.proteinType.map((type) => ({ name: type })),
  },
  "Serving Size": {
    rich_text: [{ text: { content: recipe.servingSize } }],
  },
});
