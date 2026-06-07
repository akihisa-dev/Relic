import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  defaultUserDefinedFields
} from "../../shared/ipc";
import { getAppSettingsPath, readAppSettings, writeAppSettings } from "./appSettings";

describe("appSettings", () => {
  const temporaryPaths: string[] = [];

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
    await expect(readdir(userDataPath)).resolves.toEqual([path.basename(getAppSettingsPath(userDataPath))]);
  });

  it("壊れたアプリ設定ファイルでも初期設定で読み込める", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), "{ invalid json", "utf8");

    await expect(readAppSettings(userDataPath)).resolves.toEqual({
      editorSettings: defaultEditorSettings,
      featureToggles: defaultFeatureToggles,
      frontmatterTemplates: defaultFrontmatterTemplates,
      lastWorkspaceId: null,
      userDefinedFields: defaultUserDefinedFields,
      workspaces: []
    });
  });

  it("旧rightPanel機能設定を右パネル個別設定へ引き継ぐ", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      featureToggles: {
        calendar: true,
        chronicle: false,
        chronicleSettings: false,
        frontmatter: false,
        rightPanel: false,
        tools: false
      }
    }), "utf8");

    await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
      featureToggles: expect.objectContaining({
        rightPanelLinks: false,
        rightPanelOutline: false
      })
    });
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

  it("壊れたカスタムフィールドの選択肢は読み込み時に正規化する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-app-settings-"));
    temporaryPaths.push(userDataPath);
    await writeFile(getAppSettingsPath(userDataPath), JSON.stringify({
      userDefinedFields: [
        { choices: ["draft", " draft ", "", "done", "draft", 1], name: "category", type: "select" },
        { choices: ["unused"], name: "memo", type: "text" },
        { name: "tags", type: "text" },
        { name: "invalid", type: "unknown" },
        { name: "category", type: "multi-select" }
      ]
    }), "utf8");

    await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
      userDefinedFields: [
        { choices: ["draft", "done"], name: "category", type: "select" },
        { name: "memo", type: "text" }
      ]
    });
  });
});
