import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { nodeTestIncludes, rendererTestIncludes } from "./scripts/test-collection-policy.mjs";

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
          include: nodeTestIncludes,
          name: "node",
          setupFiles: ["src/test/nodeSetup.ts"]
        }
      },
      {
        extends: true,
        test: {
          environment: "jsdom",
          execArgv: rendererExecArgv,
          include: rendererTestIncludes,
          name: "renderer",
          setupFiles: ["src/test/setup.ts"]
        }
      }
    ]
  }
});
