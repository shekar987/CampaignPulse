import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "event-contracts",
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
