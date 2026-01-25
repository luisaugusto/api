import Recipe from "../recipes/schema.js";
import { zodTextFormat } from "openai/helpers/zod";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const format = zodTextFormat(Recipe, "recipe");
type RecipeType = typeof format.__output;

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
    return propertyValue.rich_text[0]?.text?.content;
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

// Extract recipe properties from Notion
const buildRecipeObject = (
  ingredients: {
    ingredient: string;
    quantity: string;
  }[],
  otherNutrition: {
    item: string;
    quantity: string;
  }[],
  properties: Record<string, unknown>,
): RecipeType =>
  ({
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
    instructions: [],
    mealType: getArrayProp(properties["Meal Type"]),
    otherNutrition,
    prepTime: getNumberProp(properties["Prep Time (min)"]),
    preparation: [],
    protein: getNumberProp(properties["Protein (g)"]),
    proteinType: getArrayProp(properties["Protein Type"]),
    servingSize: getStringProp(properties["Serving Size"]),
    title: getStringProp(properties.Name),
    tldr: "",
  }) as RecipeType;

export const convertNotionPropertiesToRecipe = (
  properties: Record<string, unknown>,
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

  return buildRecipeObject(
    ingredients,
    otherNutrition,
    properties,
  ) as RecipeType;
};
