import { describe, expect, it } from "vitest";

import {
  collectInitialManifestKeys,
  collectStaticManifestKeys,
  requiredDeferredRendererChunks,
  requiredDeferredRendererSources,
  requiredInitialRendererChunks,
  rendererInitialLoadViolations
} from "./renderer-production-check.mjs";

const requiredSources = requiredDeferredRendererSources;
const requiredChunks = requiredDeferredRendererChunks;
const requiredInitialChunks = requiredInitialRendererChunks;

describe("renderer-production-check", () => {
  it("entryから静的importだけを初期読込としてたどる", () => {
    const initial = collectInitialManifestKeys({
      dynamic: { file: "dynamic.js" },
      entry: { dynamicImports: ["dynamic"], imports: ["shared"], isEntry: true },
      shared: { imports: ["transitive"] },
      transitive: {}
    });

    expect([...initial]).toEqual(["entry", "shared", "transitive"]);
  });

  it("指定したmoduleから静的importされるchunkだけをたどる", () => {
    const imported = collectStaticManifestKeys({
      dynamic: {},
      importer: { dynamicImports: ["dynamic"], imports: ["shared"] },
      shared: { imports: ["transitive"] },
      transitive: {}
    }, ["importer"]);

    expect([...imported]).toEqual(["importer", "shared", "transitive"]);
  });

  it("Markdown preview、Mermaid、D2が初期静的importへ入る回帰を検出する", () => {
    const manifest = {
      d2: {
        src: "node_modules/@terrastruct/d2/dist/browser/index.js"
      },
      entry: { imports: ["d2", "mermaid", "preview"], isEntry: true },
      mermaid: {
        src: "node_modules/mermaid/dist/mermaid.core.mjs"
      },
      preview: {
        src: "src/renderer/previewMarkdown.ts"
      }
    };

    expect(rendererInitialLoadViolations(manifest, requiredSources)).toEqual([
      "Renderer dependency is loaded initially: node_modules/@terrastruct/d2/dist/browser/index.js",
      "Renderer dependency is loaded initially: node_modules/mermaid/dist/mermaid.core.mjs",
      "Renderer dependency is loaded initially: src/renderer/previewMarkdown.ts"
    ]);
  });

  it("必要な依存entryが出力されない回帰を検出する", () => {
    expect(rendererInitialLoadViolations({ entry: { isEntry: true } }, requiredSources)).toEqual([
      "Required renderer dependency was not emitted: node_modules/@terrastruct/d2/dist/browser/index.js",
      "Required renderer dependency was not emitted: node_modules/mermaid/dist/mermaid.core.mjs",
      "Required renderer dependency was not emitted: src/renderer/previewMarkdown.ts"
    ]);
  });

  it("遅延moduleを経由する依存を初期読込として扱わない", () => {
    const manifest = {
      d2: { src: "node_modules/@terrastruct/d2/dist/browser/index.js" },
      entry: { dynamicImports: ["feature"], isEntry: true },
      feature: { dynamicImports: ["d2", "mermaid", "preview"] },
      mermaid: { src: "node_modules/mermaid/dist/mermaid.core.mjs" },
      preview: { src: "src/renderer/previewMarkdown.ts" }
    };

    expect(rendererInitialLoadViolations(manifest, requiredSources)).toEqual([]);
  });

  it("pnpm仮想ストアの依存pathを正規化する", () => {
    const d2 = "node_modules/.pnpm/@terrastruct+d2@0.1.33/node_modules/@terrastruct/d2/dist/browser/index.js";
    const mermaid = "node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/mermaid.core.mjs";
    const manifest = {
      [d2]: { src: d2 },
      entry: { dynamicImports: [d2, mermaid, "preview"], isEntry: true },
      [mermaid]: { src: mermaid },
      preview: { src: "src/renderer/previewMarkdown.ts" }
    };

    expect(rendererInitialLoadViolations(manifest, requiredSources)).toEqual([]);
  });

  it("markedとhighlight.jsをMarkdown previewの遅延静的経路に保つ", () => {
    const manifest = {
      entry: { dynamicImports: ["preview"], imports: ["runtime"], isEntry: true },
      highlight: { name: "markdown-highlight" },
      parser: { name: "markdown-parser" },
      preview: {
        imports: ["highlight", "parser", "runtime"],
        src: "src/renderer/previewMarkdown.ts"
      },
      runtime: { name: "markdown-runtime" }
    };

    expect(rendererInitialLoadViolations(manifest, [], requiredChunks)).toEqual([]);
  });

  it("markedとhighlight.jsのchunkが初期静的importへ入る回帰を検出する", () => {
    const manifest = {
      entry: {
        dynamicImports: ["preview"],
        imports: ["highlight", "parser"],
        isEntry: true
      },
      highlight: { name: "markdown-highlight" },
      parser: { name: "markdown-parser" },
      preview: {
        imports: ["highlight", "parser"],
        src: "src/renderer/previewMarkdown.ts"
      }
    };

    expect(rendererInitialLoadViolations(manifest, [], requiredChunks)).toEqual([
      "Renderer dependency chunk is loaded initially for marked: markdown-parser",
      "Renderer dependency chunk is loaded initially for highlight.js: markdown-highlight"
    ]);
  });

  it("保護対象dependencyがMarkdown previewの静的経路から外れる回帰を検出する", () => {
    const manifest = {
      highlight: { name: "markdown-highlight" },
      parser: { name: "markdown-parser" },
      preview: {
        imports: ["parser"],
        src: "src/renderer/previewMarkdown.ts"
      }
    };

    expect(rendererInitialLoadViolations(manifest, [], requiredChunks)).toEqual([
      "Renderer dependency is outside the protected static path src/renderer/previewMarkdown.ts -> highlight.js: markdown-highlight"
    ]);
  });

  it("同期利用するKaTeXとDOMPurifyのchunkを初期静的経路に保つ", () => {
    const manifest = {
      entry: { imports: ["runtime"], isEntry: true },
      runtime: { name: "markdown-runtime" }
    };

    expect(rendererInitialLoadViolations(
      manifest,
      [],
      [],
      requiredInitialChunks
    )).toEqual([]);
  });

  it("KaTeXとDOMPurifyのchunkが初期静的経路から外れる回帰を検出する", () => {
    const manifest = {
      entry: { dynamicImports: ["runtime"], isEntry: true },
      runtime: { name: "markdown-runtime" }
    };

    expect(rendererInitialLoadViolations(
      manifest,
      [],
      [],
      requiredInitialChunks
    )).toEqual([
      "Renderer dependency chunk is not loaded initially for KaTeX and DOMPurify: markdown-runtime"
    ]);
  });
});
