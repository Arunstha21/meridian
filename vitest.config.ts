import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    environment: "node",
    globals: false,
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
    globalSetup: ["./tests/setup/global.ts"],
    setupFiles: ["./tests/setup/env.ts"],
    include: ["tests/**/*.test.ts"]
  }
});
