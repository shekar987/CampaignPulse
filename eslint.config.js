// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.vite/**",
      "apps/api/src/generated/**",
      "apps/api/src/graphql/generated/**",
      "apps/web/src/gql/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ["apps/web/src/**/*.tsx"],
    ...reactRefresh.configs.vite,
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["apps/api/**/*.ts", "packages/**/*.ts", "*.ts", "*.js"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "no-console": "off" },
  },
  prettier,
);
