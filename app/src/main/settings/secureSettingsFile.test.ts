import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

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

  it("macOS / Linuxでは設定ディレクトリとファイルをユーザー限定権限にする", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-secure-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = path.join(userDataPath, "workspaces", "ws-1.json");

    await writePrivateSettingsTextFile(settingsPath, "{}\n");

    if (process.platform === "win32") return;
    expect((await stat(path.dirname(settingsPath))).mode & 0o777).toBe(privateSettingsDirectoryMode);
    expect((await stat(settingsPath)).mode & 0o777).toBe(privateSettingsFileMode);
  });
});
