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
      "@typescript-eslint/unified-signatures": "off",
      camelcase: ["off"],
      "init-declarations": ["off"],
      "max-lines-per-function": ["error", 80],
      "max-statements": ["error", 40],
      "no-magic-numbers": ["off"],
      "no-ternary": ["off"],
      "no-undefined": "off",
      "one-var": ["error", "never"],
    },
  },
);
