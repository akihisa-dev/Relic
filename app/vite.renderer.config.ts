import react from "@vitejs/plugin-react";
import { mergeConfig, type Plugin } from "vite";

import baseConfig from "./vite.base.config";
import { rendererContentSecurityPolicy } from "./src/shared/rendererCsp";

const mermaidPreviewPackages = [
  "@braintree/sanitize-url",
  "@iconify",
  "@mermaid-js",
  "@upsetjs/venn.js",
  "commander",
  "cose-base",
  "cytoscape",
  "cytoscape-cose-bilkent",
  "cytoscape-fcose",
  "d3",
  "d3-",
  "dagre-d3-es",
  "dayjs",
  "delaunator",
  "es-toolkit",
  "hachure-fill",
  "iconv-lite",
  "internmap",
  "khroma",
  "layout-base",
  "lodash-es",
  "mermaid",
  "package-manager-detector",
  "path-data-parser",
  "points-on-curve",
  "points-on-path",
  "robust-predicates",
  "roughjs",
  "rw",
  "stylis",
  "tinyexec",
  "ts-dedent",
  "uuid"
];

function isMermaidPreviewDependency(id: string): boolean {
  const normalized = id.replace(/\\/g, "/");

  return mermaidPreviewPackages.some((packageName) => normalized.includes(`/node_modules/${packageName}`));
}

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

          if (id.includes("@terrastruct/d2")) return "d2-preview";
          if (isMermaidPreviewDependency(id)) return "mermaid-preview";
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
  plugins: [rendererCspPlugin(), react()]
});
