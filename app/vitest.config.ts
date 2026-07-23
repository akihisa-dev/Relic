import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rendererExecArgv = process.allowedNodeEnvironmentFlags.has("--no-experimental-webstorage")
  ? ["--no-experimental-webstorage"]
  : [];

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      exclude: ["scripts/**"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage",
    },
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          environment: "node",
          include: [
            "build-tools/**/*.{test,spec}.ts",
            "scripts/**/*.{test,spec}.mjs",
            "src/main/**/*.{test,spec}.{ts,tsx}",
            "src/preload/**/*.{test,spec}.{ts,tsx}",
            "src/shared/**/*.{test,spec}.{ts,tsx}"
          ],
          name: "node",
          setupFiles: ["src/test/nodeSetup.ts"]
        }
      },
      {
        extends: true,
        test: {
          environment: "jsdom",
          execArgv: rendererExecArgv,
          include: ["src/renderer/**/*.{test,spec}.{ts,tsx}"],
          name: "renderer",
          setupFiles: ["src/test/setup.ts"]
        }
      }
    ]
  }
});
