import react from "@vitejs/plugin-react";
import { mergeConfig, type Plugin } from "vite";

import { katexWoff2OnlyCssPlugin } from "./build-tools/katexFontCss";
import baseConfig from "./vite.base.config";
import { rendererContentSecurityPolicy } from "./src/shared/rendererCsp";

function rendererCspPlugin(): Plugin {
  return {
    name: "relic-renderer-csp",
    transformIndexHtml(html, context) {
      return html.replace(
        "__RELIC_RENDERER_CSP__",
        rendererContentSecurityPolicy(Boolean(context.server))
      );
    }
  };
}

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

          return undefined;
        }
      }
    }
  },
  optimizeDeps: {
    entries: ["index.html"]
  },
  plugins: [katexWoff2OnlyCssPlugin(), rendererCspPlugin(), react()]
});
