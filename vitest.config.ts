import { defineConfig } from "vitest/config";

// One test run for the whole workspace; tests live next to the code they test.
export default defineConfig({
  test: {
    include: ["libs/utils/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
  },
});
