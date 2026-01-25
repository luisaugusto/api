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

const validateEntity = (
  entity: Record<string, unknown> | undefined,
): boolean => {
  if (!entity || typeof entity.id !== "string" || entity.type !== "comment") {
    // eslint-disable-next-line no-console
    console.log("Failed: entity validation", {
      hasEntity: Boolean(entity),
      idIsString: typeof entity?.id === "string",
      typeIsComment: entity?.type === "comment",
    });
    return false;
  }
  return true;
};

const validateData = (data: Record<string, unknown> | undefined): boolean => {
  if (
    !data ||
    typeof data.page_id !== "string" ||
    !data.parent ||
    typeof data.parent !== "object"
  ) {
    // eslint-disable-next-line no-console
    console.log("Failed: data validation", {
      hasData: Boolean(data),
      hasParent: Boolean(data?.parent),
      pageIdIsString: typeof data?.page_id === "string",
    });
    return false;
  }
  return true;
};

export const validateWebhookPayload = (
  payload: unknown,
): payload is NotionWebhookPayload => {
  // eslint-disable-next-line no-console
  console.log("Webhook validation starting", payload);

  if (!payload || typeof payload !== "object") {
    // eslint-disable-next-line no-console
    console.log("Failed: payload is not an object");
    return false;
  }
  const payload2 = payload as Record<string, unknown>;

  if (payload2.type !== "comment.created") {
    // eslint-disable-next-line no-console
    console.log("Failed: type is not comment.created", payload2.type);
    return false;
  }

  const entity = payload2.entity as Record<string, unknown> | undefined;
  if (!validateEntity(entity)) return false;

  const data = payload2.data as Record<string, unknown> | undefined;
  if (!validateData(data)) return false;

  // eslint-disable-next-line no-console
  console.log("Webhook validation passed");
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
  // eslint-disable-next-line no-console
  console.log("buildModificationPrompt: currentRecipe", currentRecipe);
  // eslint-disable-next-line no-console
  console.log(
    "buildModificationPrompt: preparation",
    currentRecipe.preparation,
  );
  // eslint-disable-next-line no-console
  console.log(
    "buildModificationPrompt: instructions",
    currentRecipe.instructions,
  );

  const promptContent = buildPromptContent(currentRecipe);
  // eslint-disable-next-line no-console
  console.log("buildModificationPrompt: promptContent", promptContent);

  const prompt = `${promptContent}
Modification request from the user:
"${modificationRequest}"

Please update the recipe according to this request and return the complete updated recipe details.
Also include a 'changeDescription' field that explains what you changed in the recipe.`;
  return prompt;
};
