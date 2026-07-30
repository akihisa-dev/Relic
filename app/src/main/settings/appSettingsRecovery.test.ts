import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { currentAppSettingsSchemaVersion, getAppSettingsPath } from "./appSettings";
import {
  readAppSettingsForStartup,
  replaceAppSettingsWithDefaults
} from "./appSettingsRecovery";

describe("appSettingsRecovery", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryPaths.splice(0).map((temporaryPath) =>
      rm(temporaryPath, { force: true, recursive: true })
    ));
  });

  it("壊れた設定を内容が残るバックアップへ退避して復旧状態を返す", async () => {
    const userDataPath = await createTemporaryUserData();
    const settingsPath = getAppSettingsPath(userDataPath);
    const corruptContent = "{ invalid json";
    await writeFile(settingsPath, corruptContent, "utf8");

    const startup = await readAppSettingsForStartup(userDataPath);

    expect(startup).toMatchObject({
      recovery: {
        kind: "corrupt",
        settingsPath
      },
      status: "recovery-required"
    });
    if (startup.status !== "recovery-required") throw new Error("復旧状態が必要です。");
    expect(startup.recovery.backupPath).toMatch(/app-settings\.corrupt-\d+\.json$/);
    await expect(readFile(startup.recovery.backupPath!, "utf8")).resolves.toBe(corruptContent);
    await expect(readFile(settingsPath, "utf8")).rejects.toHaveProperty("code", "ENOENT");
  });

  it("壊れた設定の復旧画面を閉じるだけでは新しい設定を書き込まない", async () => {
    const userDataPath = await createTemporaryUserData();
    await writeFile(getAppSettingsPath(userDataPath), "{ invalid json", "utf8");

    const startup = await readAppSettingsForStartup(userDataPath);

    expect(startup.status).toBe("recovery-required");
    expect((await readdir(userDataPath)).some((name) => name === "app-settings.json")).toBe(false);
    await expect(readAppSettingsForStartup(userDataPath)).resolves.toMatchObject({
      recovery: {
        kind: "corrupt"
      },
      status: "recovery-required"
    });
  });

  it("壊れた設定から初期設定を選ぶとバックアップを残して現行設定を作る", async () => {
    const userDataPath = await createTemporaryUserData();
    await writeFile(getAppSettingsPath(userDataPath), "{ invalid json", "utf8");
    const startup = await readAppSettingsForStartup(userDataPath);
    if (startup.status !== "recovery-required") throw new Error("復旧状態が必要です。");
    const backupPath = startup.recovery.backupPath!;

    const settings = await replaceAppSettingsWithDefaults(userDataPath, startup.recovery);

    expect(settings.workspaces).toEqual([]);
    const current = JSON.parse(await readFile(getAppSettingsPath(userDataPath), "utf8")) as {
      schemaVersion: number;
    };
    expect(current.schemaVersion).toBe(currentAppSettingsSchemaVersion);
    await expect(readFile(backupPath, "utf8")).resolves.toBe("{ invalid json");
  });

  it("非対応設定は復旧状態のままでは変更せず初期設定選択時にだけ別名退避する", async () => {
    const userDataPath = await createTemporaryUserData();
    const settingsPath = getAppSettingsPath(userDataPath);
    const unsupportedContent = JSON.stringify({
      schemaVersion: currentAppSettingsSchemaVersion + 1,
      workspaces: [{ id: "future" }]
    });
    await writeFile(settingsPath, unsupportedContent, "utf8");

    const startup = await readAppSettingsForStartup(userDataPath);

    expect(startup).toEqual({
      recovery: {
        backupPath: null,
        kind: "unsupported",
        settingsPath
      },
      status: "recovery-required"
    });
    await expect(readFile(settingsPath, "utf8")).resolves.toBe(unsupportedContent);
    if (startup.status !== "recovery-required") throw new Error("復旧状態が必要です。");

    await replaceAppSettingsWithDefaults(userDataPath, startup.recovery);

    expect(startup.recovery.backupPath).toMatch(/app-settings\.unsupported-\d+\.json$/);
    await expect(readFile(startup.recovery.backupPath!, "utf8")).resolves.toBe(unsupportedContent);
    const current = JSON.parse(await readFile(settingsPath, "utf8")) as { schemaVersion: number };
    expect(current.schemaVersion).toBe(currentAppSettingsSchemaVersion);
    expect((await readdir(userDataPath)).some((name) => name === "app-settings.recovery.json")).toBe(false);
  });

  it("初回起動は従来どおり初期値を通常起動状態として返す", async () => {
    const userDataPath = await createTemporaryUserData();

    await expect(readAppSettingsForStartup(userDataPath)).resolves.toMatchObject({
      settings: {
        editorSettings: {
          language: "en"
        },
        workspaces: []
      },
      status: "ready"
    });
    await expect(readdir(userDataPath)).resolves.toEqual([]);
  });

  async function createTemporaryUserData(): Promise<string> {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-recovery-"));
    temporaryPaths.push(userDataPath);
    return userDataPath;
  }
});
