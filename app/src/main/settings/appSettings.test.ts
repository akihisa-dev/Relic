import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields
} from "../../shared/ipc";
import { getAppSettingsPath, readAppSettings, updateAppSettings, writeAppSettings } from "./appSettings";

describe("appSettings", () => {
  const temporaryPaths: string[] = [];
  const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("アプリ設定を安全書き込み後に読み込める", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);

    await writeAppSettings(userDataPath, {
      editorSettings: { ...defaultEditorSettings, language: "ja" },
      featureToggles: { ...defaultFeatureToggles, tools: true },
      frontmatterTemplates: defaultFrontmatterTemplates,
      lastWorkspaceId: "ws-1",
      userDefinedFields: defaultUserDefinedFields,
      workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
    });

    await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
      editorSettings: expect.objectContaining({ language: "ja" }),
      featureToggles: expect.objectContaining({ tools: true }),
      lastWorkspaceId: "ws-1",
      workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
    });
    const raw = JSON.parse(await readFile(getAppSettingsPath(userDataPath), "utf8")) as Record<string, unknown>;
    expect(raw.schemaVersion).toBe(6);
    await expect(readdir(userDataPath)).resolves.toEqual([path.basename(getAppSettingsPath(userDataPath))]);
    expect((await stat(userDataPath)).mode & 0o777).toBe(0o700);
    expect((await stat(getAppSettingsPath(userDataPath))).mode & 0o777).toBe(0o600);
  });

  it("壊れたアプリ設定ファイルは退避したうえで読み込みエラーになる", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), "{ invalid json", "utf8");

    await expect(readAppSettings(userDataPath)).rejects.toHaveProperty("name", "CorruptAppSettingsError");
    const files = await readdir(userDataPath);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^app-settings\.corrupt-\d+\.json$/);
  });

  it.each([undefined, 0, 5])("旧schemaVersion %s は変更せず読み込みを拒否する", async (schemaVersion) => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = getAppSettingsPath(userDataPath);
    const raw = JSON.stringify({
      ...(schemaVersion === undefined ? {} : { schemaVersion }),
      featureToggles: {
        chronicle: false,
        tools: false
      },
      workspaces: []
    });
    await writeFile(settingsPath, raw, "utf8");

    await expect(readAppSettings(userDataPath)).rejects.toHaveProperty("name", "UnsupportedSettingsVersionError");
    await expect(readFile(settingsPath, "utf8")).resolves.toBe(raw);
  });

  it("同時更新は更新ヘルパーで直列化される", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeAppSettings(userDataPath, {
      editorSettings: defaultEditorSettings,
      featureToggles: defaultFeatureToggles,
      frontmatterTemplates: defaultFrontmatterTemplates,
      lastWorkspaceId: null,
      userDefinedFields: defaultUserDefinedFields,
      workspaces: []
    });

    const firstUpdate = updateAppSettings(userDataPath, async (settings) => {
      await delay(30);
      return {
        ...settings,
        workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/notes" }],
        lastWorkspaceId: "ws-1"
      };
    });
    const secondUpdate = updateAppSettings(userDataPath, (settings) => ({
      ...settings,
      featureToggles: {
        ...settings.featureToggles,
        tools: true
      }
    }));

    await Promise.all([firstUpdate, secondUpdate]);
    const loaded = await readAppSettings(userDataPath);

    expect(loaded.lastWorkspaceId).toBe("ws-1");
    expect(loaded.workspaces).toEqual([{ id: "ws-1", name: "Notes", path: "/tmp/notes" }]);
    expect(loaded.featureToggles.tools).toBe(true);
  });

  it("別の設定ファイルの更新は完了待ちに巻き込まれない", async () => {
    const firstUserDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-first-"));
    const secondUserDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-second-"));
    temporaryPaths.push(firstUserDataPath, secondUserDataPath);
    let releaseFirstUpdate: (() => void) | undefined;
    const firstUpdateCanFinish = new Promise<void>((resolve) => {
      releaseFirstUpdate = resolve;
    });
    let notifyFirstUpdateStarted: (() => void) | undefined;
    const firstUpdateStarted = new Promise<void>((resolve) => {
      notifyFirstUpdateStarted = resolve;
    });
    let notifySecondUpdateStarted: (() => void) | undefined;
    const secondUpdateStarted = new Promise<void>((resolve) => {
      notifySecondUpdateStarted = resolve;
    });

    const firstUpdate = updateAppSettings(firstUserDataPath, async (settings) => {
      notifyFirstUpdateStarted?.();
      await firstUpdateCanFinish;
      return settings;
    });
    await Promise.race([
      firstUpdateStarted,
      delay(1000).then(() => {
        throw new Error("最初の設定ファイルの更新が開始されませんでした。");
      })
    ]);

    const secondUpdate = updateAppSettings(secondUserDataPath, (settings) => {
      notifySecondUpdateStarted?.();
      return settings;
    });
    try {
      await Promise.race([
        secondUpdateStarted,
        delay(1000).then(() => {
          throw new Error("別の設定ファイルの更新が開始されませんでした。");
        })
      ]);
    } finally {
      releaseFirstUpdate?.();
      await Promise.all([firstUpdate, secondUpdate]);
    }
  });

  it("未知の将来schemaVersionは旧形式として誤読しない", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = getAppSettingsPath(userDataPath);
    const raw = JSON.stringify({
      schemaVersion: 999,
      featureToggles: { graph: false }
    });
    await writeFile(settingsPath, raw, "utf8");

    await expect(readAppSettings(userDataPath)).rejects.toHaveProperty("name", "UnsupportedSettingsVersionError");
    await expect(readFile(settingsPath, "utf8")).resolves.toBe(raw);
    await expect(readdir(userDataPath)).resolves.toEqual([path.basename(getAppSettingsPath(userDataPath))]);
  });

  it("オブジェクトではないアプリ設定ファイルでも初期設定で読み込める", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), "[]", "utf8");

    await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
      lastWorkspaceId: null,
      workspaces: []
    });
  });

  it("壊れたワークスペース登録は設定読み込み時に除外する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      schemaVersion: 6,
      lastWorkspaceId: "ws-valid",
      workspaces: [
        { id: "ws-valid", name: "Notes", path: "/tmp/Notes" },
        { id: "", name: "Empty ID", path: "/tmp/Empty" },
        { id: "ws-empty-name", name: " ", path: "/tmp/EmptyName" },
        { id: "ws-relative", name: "Relative", path: "relative/Notes" },
        { id: "ws-dotdot", name: "DotDot", path: "/tmp/Notes/.." },
        { id: "../outside", name: "Traversal", path: "/tmp/Traversal" },
        { id: "folder/ws", name: "Slash", path: "/tmp/Slash" },
        { id: " ws-space ", name: "Space", path: "/tmp/Space" },
        { id: "ws-valid", name: "Duplicate", path: "/tmp/Duplicate" }
      ]
    }), "utf8");

    await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
      lastWorkspaceId: "ws-valid",
      workspaces: [{ id: "ws-valid", name: "Notes", path: "/tmp/Notes" }]
    });
  });

  it("登録一覧に存在しない最後のワークスペースIDは読み込み時に除外する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      schemaVersion: 6,
      lastWorkspaceId: "ws-missing",
      workspaces: [{ id: "ws-valid", name: "Notes", path: "/tmp/Notes" }]
    }), "utf8");

    await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
      lastWorkspaceId: null,
      workspaces: [{ id: "ws-valid", name: "Notes", path: "/tmp/Notes" }]
    });
  });

  it("壊れたエディタ設定の数値は読み込み時に既定値へ戻す", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      schemaVersion: 6,
      editorSettings: {
        ...defaultEditorSettings,
        fontSize: 1e999,
        lineHeight: 0
      },
      workspaces: []
    }), "utf8");

    await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
      editorSettings: expect.objectContaining({
        fontSize: defaultEditorSettings.fontSize,
        lineHeight: defaultEditorSettings.lineHeight
      })
    });
  });

  it("有効なエディタ設定の選択値をそのまま復元する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      schemaVersion: 6,
      editorSettings: {
        font: "gothic",
        fontSize: 18,
        frontmatterDateFormat: "system",
        language: "system",
        lineHeight: 1.8,
        maxWidth: "550px",
        showLineNumbers: true,
        spellCheck: false,
        theme: "light"
      },
      workspaces: []
    }), "utf8");

    await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
      editorSettings: {
        font: "gothic",
        fontSize: 18,
        frontmatterDateFormat: "system",
        language: "system",
        lineHeight: 1.8,
        maxWidth: "550px",
        showLineNumbers: true,
        spellCheck: false,
        theme: "light"
      }
    });
  });

  it("型が壊れた表示設定と機能設定は項目ごとの安全な既定値へ戻す", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      schemaVersion: 6,
      editorSettings: {
        font: 1,
        fontSize: "large",
        frontmatterDateFormat: 1,
        language: 1,
        lineHeight: "wide",
        maxWidth: 1,
        showLineNumbers: "yes",
        spellCheck: "yes",
        theme: 1
      },
      featureToggles: {
        chronicle: "yes",
        frontmatter: "yes",
        graph: "yes",
        tools: "yes"
      },
      workspaces: []
    }), "utf8");

    await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
      editorSettings: defaultEditorSettings,
      featureToggles: defaultFeatureToggles
    });
  });

  it("壊れたテンプレートを除外し、有効なフィールド名だけを復元する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      schemaVersion: 6,
      frontmatterTemplates: [
        null,
        "invalid",
        { fieldNames: ["priority"], name: 1 },
        { fieldNames: ["priority"], name: " " },
        { fieldNames: "priority", name: "No fields" },
        { fieldNames: [1, "bad:name", "priority"], name: " Task " },
        { fieldNames: ["status"], name: "Task" }
      ],
      workspaces: []
    }), "utf8");

    await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
      frontmatterTemplates: [
        { fieldNames: ["priority"], name: "Task" }
      ]
    });
  });

  it("壊れたカスタムフィールドの選択肢は読み込み時に正規化する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      schemaVersion: 6,
      userDefinedFields: [
        null,
        "invalid",
        { name: 1, type: "text" },
        { name: "bad:name", type: "text" },
        { choices: ["draft", " draft ", "", "done", "draft", 1], name: "status", type: "select" },
        { name: "status", type: "text" },
        { choices: ["unused"], name: "memo", type: "text" },
        { name: "tags", type: "text" },
        { name: "category", type: "text" },
        { name: "plannedDate", type: "date" },
        { name: "invalid", type: "unknown" },
        { name: "category", type: "multi-select" }
      ]
    }), "utf8");

    await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
      userDefinedFields: [
        { choices: ["draft", "done"], name: "status", type: "select" },
        { name: "memo", type: "text" },
        { name: "plannedDate", type: "date" }
      ]
    });
  });
});
