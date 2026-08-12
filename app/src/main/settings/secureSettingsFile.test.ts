import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  privateSettingsDirectoryMode,
  privateSettingsFileMode,
  writePrivateSettingsTextFile
} from "./secureSettingsFile";

describe("secureSettingsFile", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryPaths.splice(0).map((temporaryPath) => rm(temporaryPath, { force: true, recursive: true })));
  });

  it("設定ディレクトリとファイルをユーザー限定権限にする", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-secure-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = path.join(userDataPath, "workspaces", "ws-1.json");

    await writePrivateSettingsTextFile(settingsPath, "{}\n");

    expect((await stat(path.dirname(settingsPath))).mode & 0o777).toBe(privateSettingsDirectoryMode);
    expect((await stat(settingsPath)).mode & 0o777).toBe(privateSettingsFileMode);
  });

  it("一時ファイルの権限保護に失敗した場合は旧設定とcleanupを保持する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-secure-settings-fail-closed-"));
    temporaryPaths.push(userDataPath);
    const settingsDirectory = path.join(userDataPath, "workspaces");
    const settingsPath = path.join(settingsDirectory, "ws-1.json");
    await mkdir(settingsDirectory);
    await writeFile(settingsPath, "{\"version\":1}\n", "utf8");
    const chmod = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error(`${settingsPath} must remain private`));

    await expect(writePrivateSettingsTextFile(settingsPath, "{\"version\":2}\n", {
      chmod,
      mkdir: async () => undefined
    })).rejects.toThrow("設定ファイルの権限を保護できませんでした。");

    await expect(readFile(settingsPath, "utf8")).resolves.toBe("{\"version\":1}\n");
    await expect(readdir(settingsDirectory)).resolves.toEqual(["ws-1.json"]);
    expect(chmod).toHaveBeenCalledTimes(2);
    expect(chmod.mock.calls[1][0]).not.toBe(settingsPath);
  });

  it("ディレクトリ権限の保護に失敗した場合は設定を書き込まない", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-secure-settings-directory-failure-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = path.join(userDataPath, "workspaces", "ws-1.json");
    const chmod = vi.fn().mockRejectedValue(new Error(`${path.dirname(settingsPath)} is not private`));

    await expect(writePrivateSettingsTextFile(settingsPath, "{}\n", {
      chmod,
      mkdir: async () => undefined
    })).rejects.toThrow("設定ファイルの権限を保護できませんでした。");

    await expect(stat(settingsPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(chmod).toHaveBeenCalledTimes(1);
  });
});
