import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { classifyTestFile, collectTestInventory } from "./test-inventory.mjs";

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

  it("生成物を除外し、すべてのテストファイルを一度だけ数える", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relic-test-inventory-"));
    temporaryDirectories.push(root);
    for (const relativePath of ["src/shared/model.test.ts", "src/renderer/View.test.tsx", "out/ignored.test.ts"]) {
      const filePath = path.join(root, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, "");
    }

    const inventory = await collectTestInventory(root);

    expect(inventory.total).toBe(2);
    expect(inventory.counts["unit-model"]).toBe(1);
    expect(inventory.counts["react-component"]).toBe(1);
  });
});
