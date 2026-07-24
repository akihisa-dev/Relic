import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  classifyTestFile,
  classifyTestProject,
  collectTestInventory,
  inspectTestSource,
  renderTestInventory
} from "./test-inventory.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("test-inventory", () => {
  it("テストを失敗責務の層へ分類する", () => {
    expect(classifyTestFile("src/renderer/components/View.test.tsx")).toBe("react-component");
    expect(classifyTestFile("src/main/ipc/contract.test.ts")).toBe("main-handler-contract");
    expect(classifyTestFile("src/preload/preload.test.ts")).toBe("preload-contract");
    expect(classifyTestFile("src/main/files/search.test.ts")).toBe("filesystem-integration");
    expect(classifyTestFile("scripts/check.test.mjs")).toBe("development-tooling");
    expect(classifyTestFile("src/shared/model.test.ts")).toBe("unit-model");
  });

  it("Vitest projectを実際の収集境界と同じ規則で分類する", () => {
    expect(classifyTestProject("src/renderer/model.test.ts")).toBe("renderer");
    expect(classifyTestProject("src/main/files/search.test.ts")).toBe("node");
    expect(classifyTestProject("scripts/check.test.mjs")).toBe("node");
  });

  it("テスト宣言、行数、無効化と単独実行指定を数える", () => {
    expect(inspectTestSource([
      "describe.only('focused suite', () => {",
      "  it('runs', () => {});",
      "  it.each([1, 2])('runs %s', () => {});",
      "  test.skip('disabled', () => {});",
      "  test.todo('pending');",
      "});",
      ""
    ].join("\n"))).toEqual({
      disabledDeclarations: 2,
      focusedDeclarations: 1,
      lines: 6,
      testDeclarations: 4
    });
  });

  it("生成物を除外し、規模と要整理対象を含めて一度だけ数える", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relic-test-inventory-"));
    temporaryDirectories.push(root);
    const sources = new Map([
      ["src/shared/model.test.ts", "it('works', () => {});\n"],
      ["src/renderer/View.test.tsx", `${"// setup\n".repeat(700)}it.skip('later', () => {});\n`],
      ["out/ignored.test.ts", "it.only('ignored', () => {});\n"]
    ]);
    for (const [relativePath, source] of sources) {
      const filePath = path.join(root, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, source);
    }

    const inventory = await collectTestInventory(root);

    expect(inventory.total).toBe(2);
    expect(inventory.counts["unit-model"]).toBe(1);
    expect(inventory.counts["react-component"]).toBe(1);
    expect(inventory.projects).toEqual({ node: 1, renderer: 1 });
    expect(inventory.totals).toEqual({
      disabledDeclarations: 1,
      focusedDeclarations: 0,
      lines: 702,
      testDeclarations: 2
    });
    expect(inventory.attention.map((entry) => entry.path)).toEqual(["src/renderer/View.test.tsx"]);
  });

  it("人が確認できる棚卸し結果を表示する", () => {
    const output = renderTestInventory({
      attention: [{
        disabledDeclarations: 1,
        focusedDeclarations: 0,
        lines: 720,
        path: "src/renderer/View.test.tsx",
        testDeclarations: 3
      }],
      counts: { "unit-model": 1 },
      projects: { node: 1, renderer: 0 },
      total: 1,
      totals: {
        disabledDeclarations: 1,
        focusedDeclarations: 0,
        lines: 720,
        testDeclarations: 3
      }
    });

    expect(output).toContain("test-declarations: 3");
    expect(output).toContain("720 lines | 3 declarations | 1 disabled | src/renderer/View.test.tsx");
  });
});
