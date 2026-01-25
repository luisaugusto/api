import Recipe from "../schema.js";
import { zodTextFormat } from "openai/helpers/zod";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const format = zodTextFormat(Recipe, "recipe");
type RecipeType = typeof format.__output;

export interface NotionWebhookPayload {
  type: string;
  entity: {
    id: string;
    type: string;
  };
  data: {
    page_id: string;
    parent: {
      id: string;
      type: string;
    };
  };
}

const validateEntity = (entity: Record<string, unknown> | undefined): boolean =>
  !entity || typeof entity.id !== "string" || entity.type !== "comment";

const validateData = (data: Record<string, unknown> | undefined): boolean =>
  !data ||
  typeof data.page_id !== "string" ||
  !data.parent ||
  typeof data.parent !== "object";

export const validateWebhookPayload = (
  payload: unknown,
): payload is NotionWebhookPayload => {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const payload2 = payload as Record<string, unknown>;

  if (payload2.type !== "comment.created") {
    return false;
  }

  const entity = payload2.entity as Record<string, unknown> | undefined;
  if (!validateEntity(entity)) return false;

  const data = payload2.data as Record<string, unknown> | undefined;
  if (!validateData(data)) return false;

  return true;
};

export const extractIds = (
  payload: NotionWebhookPayload,
): {
  pageId: string;
  commentId: string;
} => {
  const pageId = payload.data.page_id;
  const commentId = payload.entity.id;
  return { commentId, pageId };
};

export const hasModifyTag = (commentText: string): boolean =>
  commentText.includes("#modify");

export const extractModificationRequest = (commentText: string): string => {
  const modifyIndex = commentText.indexOf("#modify");
  return commentText.substring(modifyIndex + 7).trim();
};

const formatSteps = (steps: string[] | undefined, label: string): string => {
  const formatted = steps?.map((step, idx) => `${idx + 1}. ${step}`).join("\n");
  return formatted ? `${label}:\n${formatted}\n` : "";
};

const buildPromptContent = (currentRecipe: Partial<RecipeType>): string => {
  const ingredientsList =
    currentRecipe.ingredients
      ?.map((ing) => `- ${ing.ingredient}: ${ing.quantity}`)
      .join("\n") || "";
  const nutritionList =
    currentRecipe.otherNutrition
      ?.map((item) => `- ${item.item}: ${item.quantity}`)
      .join("\n") || "";

  return `You are a helpful assistant that provides detailed cooking recipes.
The user wants to modify an existing recipe based on their request.

Current recipe:
Title: ${currentRecipe.title}
Description: ${currentRecipe.description}
Difficulty: ${currentRecipe.difficulty}
Country of Origin: ${currentRecipe.country}
Prep Time: ${currentRecipe.prepTime} minutes
Cook Time: ${currentRecipe.cookTime} minutes
Servings: ${currentRecipe.servingSize}
Meal Type: ${currentRecipe.mealType?.join(", ") || "N/A"}
Diet: ${currentRecipe.diet?.join(", ") || "N/A"}
Protein Type: ${currentRecipe.proteinType?.join(", ") || "N/A"}
Allergies: ${currentRecipe.allergies?.join(", ") || "None"}

Ingredients:
${ingredientsList}

Nutrition Facts (per serving):
- Calories: ${currentRecipe.calories} cal
- Protein: ${currentRecipe.protein} g
- Carbs: ${currentRecipe.carbs} g
- Fat: ${currentRecipe.fat} g
- Fiber: ${currentRecipe.fiber} g
${nutritionList ? `\nOther Nutrition:\n${nutritionList}` : ""}

${formatSteps(currentRecipe.instructions, "Instructions")}`;
};

export const buildModificationPrompt = (
  currentRecipe: Partial<RecipeType>,
  modificationRequest: string,
): string => {
  const promptContent = buildPromptContent(currentRecipe);

  const prompt = `${promptContent}
Modification request from the user:
"${modificationRequest}"

Please update the recipe according to this request and return the complete updated recipe details.
Also include a 'changeDescription' field that explains what you changed in the recipe.`;
  return prompt;
};
