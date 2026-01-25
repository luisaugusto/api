import { markdownToBlocks, markdownToRichText } from "@tryfabric/martian";
import type { Block } from "@tryfabric/martian/build/src/notion/blocks.js";
import Recipe from "../recipes/schema.js";
import { zodTextFormat } from "openai/helpers/zod";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const format = zodTextFormat(Recipe, "recipe");
type RecipeType = typeof format.__output;

export const buildImagePrompt = (recipe: RecipeType): string => {
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

interface PropertyValue {
  type: string;
  title?: { text: { content: string } }[];
  rich_text?: { text: { content: string } }[];
  number?: number;
  select?: { name: string };
  multi_select?: { name: string }[];
}

export const getPropertyValue = (prop: unknown): unknown => {
  if (!prop || typeof prop !== "object") return undefined;
  const propertyValue = prop as PropertyValue;

  if (propertyValue.type === "title" && Array.isArray(propertyValue.title)) {
    return propertyValue.title[0]?.text?.content;
  }
  if (
    propertyValue.type === "rich_text" &&
    Array.isArray(propertyValue.rich_text)
  ) {
    return propertyValue.rich_text
      .map((item) => item.text?.content || "")
      .join("");
  }
  if (propertyValue.type === "number") {
    return propertyValue.number;
  }
  if (propertyValue.type === "select") {
    return propertyValue.select?.name;
  }
  if (
    propertyValue.type === "multi_select" &&
    Array.isArray(propertyValue.multi_select)
  ) {
    return propertyValue.multi_select.map((item) => item.name);
  }
  return undefined;
};

// Get string property or default
const getStringProp = (prop: unknown, defaultValue = ""): string =>
  (getPropertyValue(prop) ?? defaultValue) as string;

// Get number property or default
const getNumberProp = (prop: unknown, defaultValue = 0): number =>
  (getPropertyValue(prop) ?? defaultValue) as number;

// Get array property or default
const getArrayProp = (prop: unknown, defaultValue: string[] = []): string[] =>
  (getPropertyValue(prop) ?? defaultValue) as string[];

// Parse ingredients from rich text (format: **ingredient** - quantity)
const parseListItem = (line: string): { first: string; second: string } => {
  const parts = line.split(" - ");
  if (parts.length < 2) return { first: "", second: "" };
  const firstPart = parts[0]?.replace(/\*\*/gu, "").trim() || "";
  const secondPart = parts.slice(1).join(" - ").trim();
  return { first: firstPart, second: secondPart };
};

export const parseIngredients = (
  richText: string,
): {
  ingredient: string;
  quantity: string;
}[] =>
  richText
    .split("\n")
    .map((line) => {
      const { first, second } = parseListItem(line);
      return { ingredient: first, quantity: second };
    })
    .filter((ing) => ing.ingredient);

export const parseNutrition = (
  richText: string,
): {
  item: string;
  quantity: string;
}[] =>
  richText
    .split("\n")
    .map((line) => {
      const { first, second } = parseListItem(line);
      return { item: first, quantity: second };
    })
    .filter((item) => item.item);

// Extract block content lines as instructions
const getBlockContentLines = (blockContent: string): string[] =>
  blockContent.split("\n").filter((line) => line.trim());

// Extract recipe properties from Notion
interface RecipeData {
  ingredients: { ingredient: string; quantity: string }[];
  otherNutrition: { item: string; quantity: string }[];
  properties: Record<string, unknown>;
  blockContent: string;
}

const buildRecipeObject = ({
  ingredients,
  otherNutrition,
  properties,
  blockContent,
}: RecipeData): RecipeType => {
  const lines = getBlockContentLines(blockContent);
  return {
    allergies: getArrayProp(properties.Allergies),
    calories: getNumberProp(properties["Calories (cal)"]),
    carbs: getNumberProp(properties["Carbs (g)"]),
    cookTime: getNumberProp(properties["Cook Time (min)"]),
    country: getStringProp(properties["Country of Origin"]),
    description: getStringProp(properties.Description),
    diet: getArrayProp(properties.Diet),
    difficulty: getStringProp(properties.Difficulty),
    fat: getNumberProp(properties["Fat (g)"]),
    fiber: getNumberProp(properties["Fiber (g)"]),
    ingredients,
    instructions: lines,
    mealType: getArrayProp(properties["Meal Type"]),
    otherNutrition,
    prepTime: getNumberProp(properties["Prep Time (min)"]),
    preparation: [],
    protein: getNumberProp(properties["Protein (g)"]),
    proteinType: getArrayProp(properties["Protein Type"]),
    servingSize: getStringProp(properties["Serving Size"]),
    title: getStringProp(properties.Name),
    tldr: "",
  } as RecipeType;
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
  rich_text: markdownToRichText(
    ingredients
      .map((ing) => `**${ing.ingredient}** - ${ing.quantity}`)
      .join("\n"),
  ),
});

const buildNutritionList = (
  otherNutrition: { item: string; quantity: string }[],
): Record<string, unknown> => ({
  rich_text: markdownToRichText(
    otherNutrition
      .map((item) => `**${item.item}** - ${item.quantity}`)
      .join("\n"),
  ),
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

export const buildBodyBlocks = (recipe: RecipeType): Block[] =>
  markdownToBlocks(`# Preparation
${recipe.preparation.map((step, index) => `${index + 1}. ${step}`).join("\n")}
# Instructions
${recipe.instructions.map((step, index) => `${index + 1}. ${step}`).join("\n")}`);

export const convertNotionPropertiesToRecipe = (
  properties: Record<string, unknown>,
  blockContent = "",
): RecipeType => {
  const ingredientsRichText = getPropertyValue(properties.Ingredients);
  const ingredients =
    ingredientsRichText && typeof ingredientsRichText === "string"
      ? parseIngredients(ingredientsRichText)
      : [];

  const nutritionRichText = getPropertyValue(properties["Nutrition Facts"]);
  const otherNutrition =
    nutritionRichText && typeof nutritionRichText === "string"
      ? parseNutrition(nutritionRichText)
      : [];

  return buildRecipeObject({
    blockContent,
    ingredients,
    otherNutrition,
    properties,
  }) as RecipeType;
};
