import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach } from "vitest";

import { findPackagedExecutable, parseElectronSmokeArgs } from "./electron-smoke.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("electron-smoke", () => {
  it("起動種別と証拠出力先を解析する", () => {
    expect(parseElectronSmokeArgs(["development"])).toEqual({
      artifactsDirectory: null,
      kind: "development"
    });
    expect(parseElectronSmokeArgs(["package", "--artifacts-dir", "evidence"])).toEqual({
      artifactsDirectory: path.resolve("evidence"),
      kind: "package"
    });
    expect(parseElectronSmokeArgs(["development", "--", "--artifacts-dir", "evidence"])).toEqual({
      artifactsDirectory: path.resolve("evidence"),
      kind: "development"
    });
  });

  it("不明な起動種別を拒否する", () => {
    expect(() => parseElectronSmokeArgs(["all"])).toThrow("Usage: pnpm smoke:electron");
  });

  it("macOS packageの実行ファイルを特定する", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relic-smoke-test-"));
    temporaryDirectories.push(root);
    const macExecutable = path.join(root, "out", "darwin", "Relic-darwin-arm64", "Relic.app", "Contents", "MacOS", "Relic");
    await mkdir(path.dirname(macExecutable), { recursive: true });
    await writeFile(macExecutable, "");

    await expect(findPackagedExecutable("darwin", root)).resolves.toBe(macExecutable);
    await expect(findPackagedExecutable("linux", root)).rejects.toThrow("supported only");
  });
});
