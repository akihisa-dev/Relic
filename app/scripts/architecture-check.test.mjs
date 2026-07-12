import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  analyzeArchitecture,
  collectModuleSpecifiers,
  formatArchitectureReport
} from "./architecture-check.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

async function createFixture(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "relic-architecture-"));
  temporaryDirectories.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
  return root;
}

describe("architecture-check", () => {
  it("静的・動的importとre-exportを解析する", () => {
    expect(collectModuleSpecifiers(`
      import type { A } from "./a";
      export { b } from "./b";
      const c = import("./c");
      const d = require("./d");
    `)).toEqual(["./a", "./b", "./c", "./d"]);
  });

  it("mainとrendererからsharedへの一方向依存を許可する", async () => {
    const root = await createFixture({
      "src/main/main.ts": `import { value } from "../shared/value"; export const mainValue = value;`,
      "src/renderer/view.ts": `import { value } from "../shared/value"; export const viewValue = value;`,
      "src/shared/value.ts": "export const value = 1;"
    });

    await expect(analyzeArchitecture(root)).resolves.toEqual({ cycles: [], violations: [] });
  });

  it("rendererとsharedからOS境界への依存を報告する", async () => {
    const root = await createFixture({
      "src/main/service.ts": "export const value = 1;",
      "src/renderer/view.ts": `import fs from "node:fs"; import { value } from "../main/service"; export { fs, value };`,
      "src/shared/contract.ts": `import { ipcRenderer } from "electron"; export { ipcRenderer };`
    });

    const result = await analyzeArchitecture(root);

    expect(result.violations).toEqual([
      "renderer/view.ts: Node.js API「node:fs」をrendererから参照しています",
      "renderer/view.ts: rendererからmainへの依存「main/service.ts」は禁止されています",
      "shared/contract.ts: Electron API「electron」をsharedから参照しています"
    ]);
  });

  it("複数ファイルの依存循環を安定順で報告する", async () => {
    const root = await createFixture({
      "src/shared/a.ts": `export { b } from "./b";`,
      "src/shared/b.ts": `export { a } from "./a";`
    });

    const result = await analyzeArchitecture(root);

    expect(result.cycles).toEqual([["shared/a.ts", "shared/b.ts"]]);
    expect(formatArchitectureReport(result)).toContain("shared/a.ts -> shared/b.ts");
  });
});
