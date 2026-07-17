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
    if (process.platform !== "win32") {
      expect((await stat(userDataPath)).mode & 0o777).toBe(0o700);
      expect((await stat(getAppSettingsPath(userDataPath))).mode & 0o777).toBe(0o600);
    }
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

  it("v0アプリ設定は読み込み時に現行schemaVersionで保存される", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      schemaVersion: 0,
      featureToggles: {
        chronicle: false,
        frontmatter: false,
        rightPanel: false,
        tools: false
      },
      workspaces: []
    }), "utf8");

    await readAppSettings(userDataPath);
    const afterFirstRead = JSON.parse(await readFile(getAppSettingsPath(userDataPath), "utf8")) as Record<string, unknown>;
    expect(afterFirstRead.schemaVersion).toBe(6);

    await delay(1100);
    const firstMtime = (await stat(getAppSettingsPath(userDataPath))).mtimeMs;
    await readAppSettings(userDataPath);
    const secondMtime = (await stat(getAppSettingsPath(userDataPath))).mtimeMs;

    expect(secondMtime).toBe(firstMtime);
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

  it("移行読み込みと同時更新で更新値が上書きされない", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      schemaVersion: 0,
      featureToggles: {
        chronicle: false,
        tools: false,
        frontmatter: false
      }
    }), "utf8");

    const update = updateAppSettings(userDataPath, async (settings) => {
      await delay(40);
      return {
        ...settings,
        featureToggles: {
          ...settings.featureToggles,
          tools: true
        }
      };
    });
    const readWhileUpdating = (async () => {
      await delay(10);
      return readAppSettings(userDataPath);
    })();

    await Promise.all([update, readWhileUpdating]);

    const raw = JSON.parse(await readFile(getAppSettingsPath(userDataPath), "utf8")) as Record<string, unknown>;
    expect(raw.schemaVersion).toBe(6);
    expect((raw.featureToggles as Record<string, unknown>)?.tools).toBe(true);
  });

  it("旧rightPanel機能設定は現行の機能設定から除外する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      featureToggles: {
        chronicle: false,
        frontmatter: false,
        rightPanel: false,
        tools: false
      }
    }), "utf8");

    const settings = await readAppSettings(userDataPath);
    expect(settings.featureToggles).not.toHaveProperty("rightPanelLinks");
    expect(settings.featureToggles).not.toHaveProperty("rightPanelOutline");
    const migrated = JSON.parse(await readFile(getAppSettingsPath(userDataPath), "utf8")) as {
      featureToggles?: Record<string, unknown>;
    };
    expect(migrated.featureToggles).not.toHaveProperty("rightPanel");
    expect(migrated.featureToggles).not.toHaveProperty("rightPanelLinks");
    expect(migrated.featureToggles).not.toHaveProperty("rightPanelOutline");
  });

  it("旧設定にない主要ビューは無効のまま現行形式へ移行する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      schemaVersion: 1,
      featureToggles: {
        chronicle: false,
        frontmatter: false,
        tools: false
      },
      workspaces: []
    }), "utf8");

    await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
      featureToggles: expect.objectContaining({ cards: false, graph: false, sphere: false })
    });
    const migrated = JSON.parse(await readFile(getAppSettingsPath(userDataPath), "utf8")) as Record<string, unknown>;
    expect(migrated.schemaVersion).toBe(6);
  });

  it("未知の将来schemaVersionは旧形式として誤読しない", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      schemaVersion: 999,
      featureToggles: { graph: false }
    }), "utf8");

    await expect(readAppSettings(userDataPath)).rejects.toHaveProperty("name", "UnsupportedSettingsVersionError");
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
