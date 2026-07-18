import { describe, expect, it } from "vitest";

import {
  collectInitialManifestKeys,
  rendererInitialLoadViolations
} from "./renderer-production-check.mjs";

const requiredSources = [
  "node_modules/@terrastruct/d2/dist/browser/index.js",
  "node_modules/mermaid/dist/mermaid.core.mjs"
];

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

  it("MermaidとD2が初期静的importへ入る回帰を検出する", () => {
    const manifest = {
      d2: {
        src: "node_modules/@terrastruct/d2/dist/browser/index.js"
      },
      entry: { imports: ["d2", "mermaid"], isEntry: true },
      mermaid: {
        src: "node_modules/mermaid/dist/mermaid.core.mjs"
      }
    };

    expect(rendererInitialLoadViolations(manifest, requiredSources)).toEqual([
      "Renderer dependency is loaded initially: node_modules/@terrastruct/d2/dist/browser/index.js",
      "Renderer dependency is loaded initially: node_modules/mermaid/dist/mermaid.core.mjs"
    ]);
  });

  it("必要な依存entryが出力されない回帰を検出する", () => {
    expect(rendererInitialLoadViolations({ entry: { isEntry: true } }, requiredSources)).toEqual([
      "Required renderer dependency was not emitted: node_modules/@terrastruct/d2/dist/browser/index.js",
      "Required renderer dependency was not emitted: node_modules/mermaid/dist/mermaid.core.mjs"
    ]);
  });

  it("遅延moduleを経由する依存を初期読込として扱わない", () => {
    const manifest = {
      d2: { src: "node_modules/@terrastruct/d2/dist/browser/index.js" },
      entry: { dynamicImports: ["feature"], isEntry: true },
      feature: { dynamicImports: ["d2", "mermaid"] },
      mermaid: { src: "node_modules/mermaid/dist/mermaid.core.mjs" }
    };

    expect(rendererInitialLoadViolations(manifest, requiredSources)).toEqual([]);
  });

  it("pnpm仮想ストアの依存pathを正規化する", () => {
    const d2 = "node_modules/.pnpm/@terrastruct+d2@0.1.33/node_modules/@terrastruct/d2/dist/browser/index.js";
    const mermaid = "node_modules/.pnpm/mermaid@11.16.0/node_modules/mermaid/dist/mermaid.core.mjs";
    const manifest = {
      [d2]: { src: d2 },
      entry: { dynamicImports: [d2, mermaid], isEntry: true },
      [mermaid]: { src: mermaid }
    };

    expect(rendererInitialLoadViolations(manifest, requiredSources)).toEqual([]);
  });
});
