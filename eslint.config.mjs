import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  globalIgnores(["node_modules", "main.js", "esbuild.config.mjs", ".test-build", "tests"]),
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      ...obsidianmd.ruleConfigs.recommendedTypeChecked,
      // Replaced by obsidianmd/no-misused-promises
      "@typescript-eslint/no-misused-promises": "off",
    },
  },
]);
