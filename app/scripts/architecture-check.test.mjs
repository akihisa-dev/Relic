import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  analyzeArchitecture,
  collectModuleSpecifiers,
  formatArchitectureReport,
  hasWindowRelicAccess,
  validateModuleResolutionPolicy
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

  it("未知のproduction層を黙って検査対象外にしない", async () => {
    const root = await createFixture({
      "src/feature/orphan.ts": "export const value = 1;"
    });

    await expect(analyzeArchitecture(root)).resolves.toMatchObject({
      violations: ["feature/orphan.ts: 未知のsource layerにproduction実装があります"]
    });
  });

  it("RendererのIPC境界をrelicClientだけに限定する", async () => {
    expect(hasWindowRelicAccess("export const api = window.relic;")).toBe(true);
    expect(hasWindowRelicAccess(`export const api = window["relic"];`)).toBe(true);
    expect(hasWindowRelicAccess("export const api = (window as Window).relic;")).toBe(true);
    expect(hasWindowRelicAccess("export const api = window!.relic;")).toBe(true);
    expect(hasWindowRelicAccess("export const api = globalThis.window.relic;")).toBe(true);
    expect(hasWindowRelicAccess(`export const api = globalThis["window"]["relic"];`)).toBe(true);
    expect(hasWindowRelicAccess("const { relic: api } = window; export { api };")).toBe(true);
    expect(hasWindowRelicAccess("export const api = otherWindow.relic;")).toBe(false);
    expect(hasWindowRelicAccess(`
      export function read(window: { relic: unknown }) {
        return window.relic;
      }
    `)).toBe(false);
    expect(hasWindowRelicAccess(`
      const window = otherWindow;
      export const api = window.relic;
    `)).toBe(false);
    expect(hasWindowRelicAccess(`
      export function read(globalThis: { window: { relic: unknown } }) {
        return globalThis.window.relic;
      }
    `)).toBe(false);

    const root = await createFixture({
      "src/renderer/direct.ts": "export const api = window.relic;",
      "src/renderer/relicClient.ts": "export const api = window.relic;"
    });

    await expect(analyzeArchitecture(root)).resolves.toMatchObject({
      violations: [
        "renderer/direct.ts: window.relicへの直接アクセスはrenderer/relicClient.tsだけに限定されています"
      ]
    });
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

  it("dynamic importとrequireでも禁止された層間依存を報告する", async () => {
    const root = await createFixture({
      "src/main/service.ts": "export const value = 1;",
      "src/renderer/dynamic.ts": `export const value = import("../main/service");`,
      "src/renderer/required.ts": `export const value = require("../main/service");`
    });

    const result = await analyzeArchitecture(root);

    expect(result.violations).toEqual([
      "renderer/dynamic.ts: rendererからmainへの依存「main/service.ts」は禁止されています",
      "renderer/required.ts: rendererからmainへの依存「main/service.ts」は禁止されています"
    ]);
  });

  it("解決できない相対importを黙って無視しない", async () => {
    const root = await createFixture({
      "src/shared/value.ts": `export { missing } from "./missing";`
    });

    await expect(analyzeArchitecture(root)).resolves.toMatchObject({
      violations: ["shared/value.ts: 相対import「./missing」を解決できません"]
    });
  });

  it("production実装から除外対象のテストへ依存できない", async () => {
    const root = await createFixture({
      "src/types/global.d.mts": "export interface GlobalContract { value: string }",
      "src/shared/value.test.ts": "export const fixture = 1;",
      "src/shared/value.ts": `export { fixture } from "./value.test";`,
      "src/renderer/viewTestHelpers.ts": "export const direct = window.relic;"
    });

    await expect(analyzeArchitecture(root)).resolves.toMatchObject({
      violations: ["shared/value.ts: 相対import「./value.test」を解決できません"]
    });
  });

  it("CSSとJSONの相対importをローカル依存として解決する", async () => {
    const root = await createFixture({
      "src/renderer/styles.css": ".view {}",
      "src/renderer/view.ts": `import "./styles.css"; import data from "./data.json"; export { data };`,
      "src/renderer/data.json": "{}"
    });

    await expect(analyzeArchitecture(root)).resolves.toEqual({ cycles: [], violations: [] });
  });

  it("未対応のTypeScript・Vite・package alias設定を拒否する", async () => {
    const root = await createFixture({
      "src/shared/value.ts": "export const value = 1;",
      "package.json": JSON.stringify({ imports: { "#shared/*": "./src/shared/*" }, workspaces: ["packages/*"] }),
      "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } } }),
      "vite.renderer.config.ts": "export default { resolve: { alias: { '@': '/src' } } };"
    });

    expect(await validateModuleResolutionPolicy(root)).toEqual([
      "package.json: package importsはarchitecture checkが対応するまで使用できません",
      "package.json: workspace packageはarchitecture checkが対応するまで使用できません",
      "tsconfig.json: compilerOptions.pathsはarchitecture checkが対応するまで使用できません",
      "tsconfig.json: compilerOptions.baseUrlはarchitecture checkが対応するまで使用できません",
      "vite.renderer.config.ts: resolve.aliasはarchitecture checkが対応するまで使用できません"
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
