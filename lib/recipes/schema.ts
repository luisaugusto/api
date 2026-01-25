import zod from "zod";

export default zod.object({
  allergies: zod
    .array(zod.string())
    .describe(
      "Allergens such as Shellfish, Peanuts, etc. It should be brief, and do not use special characters.",
    ),
  calories: zod.number().describe("Calories (cal)."),
  carbs: zod.number().describe("Carbohydrates in grams (g)."),
  changeDescription: zod
    .string()
    .optional()
    .nullable()
    .describe(
      "Summary of changes made to the recipe in the most recent update.",
    ),
  cookTime: zod.number().describe("Cooking time in minutes."),
  country: zod
    .string()
    .describe("Country or region where the recipe originates."),
  description: zod
    .string()
    .describe(
      "Short description of the recipe, such as it's origins, flavor profile, cooking techniques used, common pairings, and any other interesting details.",
    ),
  diet: zod
    .array(zod.string())
    .describe(
      "Diet types such as Keto, Vegan, Vegetarian, etc. It should be brief, and do not use special characters.",
    ),
  difficulty: zod
    .enum(["Easy", "Medium", "Hard"])
    .describe(
      "Difficulty level of the recipe in terms of time and technical skill.",
    ),
  fat: zod.number().describe("Fat in grams (g)."),
  fiber: zod.number().describe("Fiber in grams (g)."),
  ingredients: zod
    .array(
      zod.object({
        ingredient: zod.string().describe("Ingredient name."),
        quantity: zod.string().describe("Amount and unit, e.g., '2 cups'."),
      }),
    )
    .describe("List of ingredients with quantities."),
  instructions: zod
    .array(
      zod
        .string()
        .describe(
          "A single instruction step. Do not include step numbers, just the instruction.",
        ),
    )
    .describe("Step-by-step cooking instructions as an array of steps."),
  mealType: zod
    .array(zod.enum(["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"]))
    .describe("The type of meal this recipe is suitable for."),
  otherNutrition: zod
    .array(
      zod.object({
        item: zod.string().describe("Nutrition item."),
        quantity: zod.string().describe("Amount and unit, e.g., '2mg'."),
      }),
    )
    .describe(
      "Other nutritional details such as cholesterol, sodium, iron, zinc, potassium, vitamins, and minerals.",
    ),
  prepTime: zod.number().describe("Preparation time in minutes."),
  preparation: zod
    .array(
      zod
        .string()
        .describe(
          "A single preparation step. Do not include step numbers, just the instruction.",
        ),
    )
    .describe("Step-by-step preparation instructions as an array of steps."),
  protein: zod.number().describe("Protein in grams (g)."),
  proteinType: zod
    .array(
      zod.enum([
        "None",
        "Chicken",
        "Beef",
        "Pork",
        "Tofu",
        "Fish",
        "Seafood",
        "Other",
      ]),
    )
    .describe("Types of protein used in the recipe."),
  servingSize: zod
    .string()
    .describe(
      "Number of servings that the recipe makes and portion description.",
    ),
  title: zod.string().describe("Title of the recipe"),
  tldr: zod
    .string()
    .describe(
      "A brief summary and explanation of the recipe in 1-2 sentences for a general response to the prompt.",
    ),
});
