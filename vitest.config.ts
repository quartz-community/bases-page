import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    reporters: ["default"],
    // Date and duration tests use values recorded in Obsidian under this time zone
    env: { TZ: "Europe/Amsterdam" },
  },
});
