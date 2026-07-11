import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  classifySourceFile,
  collectSourceSizeEntries,
  countSourceLines,
  renderSourceSizeReport,
} from "./source-size-report.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

async function createFixture(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "relic-source-size-"));
  temporaryDirectories.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
  return root;
}

describe("source-size-report", () => {
  it("空ファイルと末尾改行を含む行数を数える", () => {
    expect(countSourceLines("")).toBe(0);
    expect(countSourceLines("a\n")).toBe(1);
    expect(countSourceLines("a\nb")).toBe(2);
  });

  it("実装、テスト、CSSを分類して個別の警告基準を返す", () => {
    expect(classifySourceFile("src/model.ts")).toEqual({ category: "implementation", warningLines: 700 });
    expect(classifySourceFile("src/model.test.ts")).toEqual({ category: "test", warningLines: 1200 });
    expect(classifySourceFile("src/styles.css")).toEqual({ category: "css", warningLines: 1000 });
  });

  it("対象拡張子だけを数え、生成物と依存物を除外して安定順で返す", async () => {
    const root = await createFixture({
      "src/same-b.ts": "1\n2\n",
      "src/same-a.tsx": "1\n2\n",
      "src/short.css": "1\n",
      "src/ignored.js": "1\n2\n3\n",
      "src/out/generated.ts": "1\n2\n3\n4\n",
      "node_modules/package/index.ts": "1\n2\n3\n4\n5\n",
      "scripts/check.mjs": "1\n2\n3\n",
    });

    const entries = await collectSourceSizeEntries(root);

    expect(entries.map((entry) => entry.path)).toEqual([
      "scripts/check.mjs",
      "src/same-a.tsx",
      "src/same-b.ts",
      "src/short.css",
    ]);
  });

  it("基準超過を警告するがレポート自体は生成する", () => {
    const report = renderSourceSizeReport([
      { category: "implementation", lines: 701, path: "src/large.ts", warning: true, warningLines: 700 },
      { category: "test", lines: 2, path: "src/small.test.ts", warning: false, warningLines: 1200 },
    ]);

    expect(report).toContain("WARN   701");
    expect(report).toContain("警告1件（警告のみ。終了コードには影響しません）");
  });

  it("分割せずに残す警告対象は理由を表示する", () => {
    const report = renderSourceSizeReport([{
      category: "css",
      lines: 1206,
      path: "src/renderer/styles/chronicle.css",
      retainedReason: "単一機能CSS",
      warning: true,
      warningLines: 1000
    }]);

    expect(report).toContain("継続理由: 単一機能CSS");
  });
});
