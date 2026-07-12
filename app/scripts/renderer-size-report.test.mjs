import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  collectInitialManifestKeys,
  collectRendererBundleReport,
  rendererBundleBaseline,
  rendererKatexFontAssetViolations,
  rendererLazyEntryViolations,
  renderRendererBundleReport
} from "./renderer-size-report.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { force: true, recursive: true })
  ));
});

async function createBundleFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "relic-renderer-size-"));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "assets"), { recursive: true });
  const files = {
    "assets/app-12345678.css": "body { color: black; }",
    "assets/d2-12345678.js": "export const d2 = true;",
    "assets/lazy-12345678.css": ".lazy { display: block; }",
    "assets/main-12345678.js": "import './shared-12345678.js';",
    "assets/mermaid-12345678.js": "export const mermaid = true;",
    "assets/shared-12345678.js": "export const shared = true;",
    "assets/worker-12345678.js": "self.onmessage = () => {};",
    "assets/KaTeX_Main-Regular-12345678.woff2": "font",
    "index.html": "<div id=\"root\"></div>"
  };
  for (const [relativePath, content] of Object.entries(files)) {
    await writeFile(path.join(root, relativePath), content);
  }
  await writeFile(path.join(root, "renderer-size-manifest.json"), JSON.stringify({
    "_d2.js": {
      assets: ["assets/KaTeX_Main-Regular-12345678.woff2"],
      css: ["assets/lazy-12345678.css"],
      file: "assets/d2-12345678.js",
      name: "d2",
      src: "node_modules/@terrastruct/d2/dist/browser/index.js"
    },
    "_mermaid.js": {
      file: "assets/mermaid-12345678.js",
      name: "mermaid",
      src: "node_modules/mermaid/dist/mermaid.core.mjs"
    },
    "_shared.js": { file: "assets/shared-12345678.js", name: "shared" },
    "index.html": {
      css: ["assets/app-12345678.css"],
      dynamicImports: ["_d2.js", "_mermaid.js"],
      file: "assets/main-12345678.js",
      imports: ["_shared.js"],
      isEntry: true,
      name: "index"
    },
    "node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff2": {
      file: "assets/KaTeX_Main-Regular-12345678.woff2",
      src: "node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff2"
    }
  }));
  return root;
}

describe("renderer-size-report", () => {
  it("entryから静的importだけを初期読込としてたどる", () => {
    const initial = collectInitialManifestKeys({
      dynamic: { file: "dynamic.js" },
      entry: { dynamicImports: ["dynamic"], imports: ["shared"], isEntry: true },
      shared: { imports: ["transitive"] },
      transitive: {}
    });
    expect([...initial]).toEqual(["entry", "shared", "transitive"]);
  });

  it("MermaidとD2の入口が初期importへ入る回帰を検出する", () => {
    const manifest = {
      d2: { src: "node_modules/@terrastruct/d2/dist/browser/index.js" },
      entry: { dynamicImports: ["d2"], imports: ["mermaid"], isEntry: true },
      mermaid: { src: "node_modules/mermaid/dist/mermaid.core.mjs" }
    };

    expect(rendererLazyEntryViolations(manifest, [
      "node_modules/@terrastruct/d2/dist/browser/index.js",
      "node_modules/mermaid/dist/mermaid.core.mjs"
    ])).toEqual([
      "Renderer dependency is loaded initially: node_modules/mermaid/dist/mermaid.core.mjs",
      "Renderer dependency is not a direct lazy entry: node_modules/mermaid/dist/mermaid.core.mjs"
    ]);
  });

  it("JavaScriptとCSSを初期・遅延へ分類し、その他のassetを分離する", async () => {
    const root = await createBundleFixture();
    const report = await collectRendererBundleReport(root);

    expect(report.files.filter((file) => file.phase === "initial").map((file) => file.logicalName))
      .toEqual(["index", "shared", "app.css"]);
    expect(report.files.filter((file) => file.phase === "deferred").map((file) => file.logicalName))
      .toEqual(["mermaid", "worker.js", "d2", "lazy.css"]);
    expect(report.files.filter((file) => file.phase === "asset").map((file) => file.logicalName))
      .toEqual(["node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff2"]);
    expect(report.metrics["total.initial.javascript.rawBytes"]).toBeGreaterThan(0);
    expect(rendererBundleBaseline(report)).toEqual({
      kind: "renderer-bundle",
      metrics: report.metrics,
      schemaVersion: 1
    });
    expect(renderRendererBundleReport(report)).toContain("initial\tjavascript");
  });

  it("KaTeXのWOFFとTTF asset再混入を検出する", () => {
    expect(rendererKatexFontAssetViolations([
      { logicalName: "node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff2", type: "asset" },
      { logicalName: "node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff", type: "asset" },
      { logicalName: "node_modules/katex/dist/fonts/KaTeX_Main-Regular.ttf", type: "asset" }
    ])).toEqual([
      "Non-WOFF2 KaTeX font asset was emitted: node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff",
      "Non-WOFF2 KaTeX font asset was emitted: node_modules/katex/dist/fonts/KaTeX_Main-Regular.ttf"
    ]);
  });
});
