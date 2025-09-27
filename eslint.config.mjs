import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

export default defineConfig(
  eslint.configs.all,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  eslintConfigPrettier,
  {
    rules: {
      "@typescript-eslint/explicit-function-return-type": "error",
      camelcase: ["off"],
      "capitalized-comments": ["off"],
      complexity: ["error", { max: 50 }],
      "init-declarations": ["off"],
      "max-lines-per-function": ["error", 200],
      "max-statements": ["error", 100],
      "no-console": ["off"],
      "no-magic-numbers": ["off"],
      "no-ternary": ["off"],
      "one-var": ["error", "never"],
    },
  },
);
