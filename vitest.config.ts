import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["apps/*/src/**", "packages/*/src/**"],
      exclude: ["**/generated/**", "**/gql/**", "**/*.test.*", "**/test/**"],
    },
  },
});
