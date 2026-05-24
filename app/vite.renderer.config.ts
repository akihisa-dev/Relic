import react from "@vitejs/plugin-react";
import { mergeConfig } from "vite";

import baseConfig from "./vite.base.config";

export default mergeConfig(baseConfig, {
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("@codemirror")) return "codemirror";
          if (id.includes("katex") || id.includes("highlight.js") || id.includes("dompurify") || id.includes("marked")) {
            return "markdown-preview";
          }
          if (id.includes("react") || id.includes("react-dom") || id.includes("scheduler")) return "react-vendor";

          return "vendor";
        }
      }
    }
  },
  optimizeDeps: {
    entries: ["index.html"]
  },
  plugins: [react()]
});
