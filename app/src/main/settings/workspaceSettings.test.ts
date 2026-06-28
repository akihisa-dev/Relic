import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { defaultChronicleCalendars } from "../../shared/ipc";
import {
  defaultCharts,
  getWorkspaceSettingsPath,
  readWorkspaceSettings,
  updateWorkspaceSettings,
  writeWorkspaceSettings
} from "./workspaceSettings";

describe("workspaceSettings", () => {
  const temporaryPaths: string[] = [];
  const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((p) => rm(p, { force: true, recursive: true }))
    );
  });

  it("設定ファイルがない場合はデフォルトを返す", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);

    const settings = await readWorkspaceSettings(userDataPath, "workspace-id");

    expect(settings.pinnedPaths).toEqual([]);
    expect(settings.chronicleCalendars).toEqual(defaultChronicleCalendars);
    expect(settings.charts).toEqual(defaultCharts);
    expect(settings.workspacePath).toBe("");
  });

  it("書き込んだ設定を読み込める", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);

    await writeWorkspaceSettings(userDataPath, "ws-1", {
      chronicleCalendars: [
        { name: "王国暦" },
        { name: "帝国暦", startYear: 100 },
        { name: "未開始暦" },
        { name: "", startYear: 200 }
      ],
      charts: [
        { filePaths: ["history/kamakura.md"], id: "chronicle", name: "歴史", source: "chronicle" }
      ],
      pinnedPaths: ["notes/readme.md", "docs"],
      workspacePath: "/Users/test/notes"
    });

    const settings = await readWorkspaceSettings(userDataPath, "ws-1");
    expect(settings.chronicleCalendars).toEqual([
      { name: "王国暦" },
      { name: "帝国暦", startYear: 100 },
      { name: "未開始暦" }
    ]);
    expect(settings.charts).toEqual([
      { filePaths: ["history/kamakura.md"], id: "chronicle", name: "chronicle", source: "chronicle" }
    ]);
    expect(settings.pinnedPaths).toEqual(["notes/readme.md", "docs"]);
    expect(settings.workspacePath).toBe("/Users/test/notes");
  });

  it("読み込み時にピン留めパスをワークスペース相対パスだけに正規化する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = getWorkspaceSettingsPath(userDataPath, "ws-pinned");
    await mkdir(path.dirname(settingsPath), { recursive: true });

    await writeFile(settingsPath, JSON.stringify({
      chronicleCalendars: defaultChronicleCalendars,
      charts: defaultCharts,
      pinnedPaths: [
        " notes/readme.md ",
        "notes/readme.md",
        "folder\\note.md",
        "../outside.md",
        "/tmp/outside.md",
        "C:\\Users\\test\\note.md",
        "",
        123
      ],
      workspacePath: "/Users/test/notes"
    }), "utf8");

    const settings = await readWorkspaceSettings(userDataPath, "ws-pinned");

    expect(settings.pinnedPaths).toEqual(["notes/readme.md", "folder/note.md"]);
  });

  it("読み込み時にチャート対象パスをワークスペース相対パスだけに正規化する", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = getWorkspaceSettingsPath(userDataPath, "ws-chart-paths");
    await mkdir(path.dirname(settingsPath), { recursive: true });

    await writeFile(settingsPath, JSON.stringify({
      chronicleCalendars: defaultChronicleCalendars,
      charts: [
        {
          filePaths: [
            " history\\old.md ",
            "history/old.md",
            "section/../notes/today.md",
            "../outside.md",
            "/tmp/outside.md",
            "C:\\Users\\test\\outside.md",
            ".",
            123
          ],
          id: "chronicle",
          name: "歴史",
          source: "chronicle"
        }
      ],
      pinnedPaths: [],
      workspacePath: "/Users/test/notes"
    }), "utf8");

    const settings = await readWorkspaceSettings(userDataPath, "ws-chart-paths");

    expect(settings.charts).toEqual([
      { filePaths: ["history/old.md", "notes/today.md"], id: "chronicle", name: "chronicle", source: "chronicle" }
    ]);
  });

  it("旧ganttChartsキーをchartsとして読み込む", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = getWorkspaceSettingsPath(userDataPath, "ws-legacy");

    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, JSON.stringify({
      chronicleCalendars: defaultChronicleCalendars,
      ganttCharts: [
        { filePaths: ["history.md"], id: "chronicle", name: "歴史", source: "chronicle" }
      ],
      pinnedPaths: [],
      workspacePath: "/Users/test/legacy"
    }), "utf8");

    const settings = await readWorkspaceSettings(userDataPath, "ws-legacy");

    expect(settings.charts).toEqual([
      { filePaths: ["history.md"], id: "chronicle", name: "chronicle", source: "chronicle" }
    ]);
  });

  it("v0ワークスペース設定は読み込み時に現行schemaVersionで保存される", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = getWorkspaceSettingsPath(userDataPath, "ws-legacy-v0");

    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, JSON.stringify({
      schemaVersion: 0,
      chronicleCalendars: defaultChronicleCalendars,
      charts: defaultCharts,
      pinnedPaths: ["notes.md"],
      workspacePath: "/Users/test/workspace"
    }), "utf8");

    await readWorkspaceSettings(userDataPath, "ws-legacy-v0");
    const afterFirstRead = JSON.parse(await readFile(settingsPath, "utf8")) as Record<string, unknown>;
    expect(afterFirstRead.schemaVersion).toBe(1);

    await delay(1100);
    const firstMtime = (await stat(settingsPath)).mtimeMs;
    await readWorkspaceSettings(userDataPath, "ws-legacy-v0");
    const secondMtime = (await stat(settingsPath)).mtimeMs;

    expect(secondMtime).toBe(firstMtime);
  });

  it("保存時はchartsキーだけを書き込む", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);

    await writeWorkspaceSettings(userDataPath, "ws-new", {
      chronicleCalendars: defaultChronicleCalendars,
      charts: defaultCharts,
      pinnedPaths: [],
      workspacePath: "/Users/test/new"
    });

    const raw = JSON.parse(await readFile(getWorkspaceSettingsPath(userDataPath, "ws-new"), "utf8")) as Record<string, unknown>;

    expect(raw.schemaVersion).toBe(1);
    expect(raw.charts).toEqual(defaultCharts);
    expect(raw.ganttCharts).toBeUndefined();
    await expect(readdir(path.dirname(getWorkspaceSettingsPath(userDataPath, "ws-new")))).resolves.toEqual([
      path.basename(getWorkspaceSettingsPath(userDataPath, "ws-new"))
    ]);
  });

  it("壊れたワークスペース設定ファイルは退避したうえで読み込みエラーになる", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = getWorkspaceSettingsPath(userDataPath, "ws-broken");
    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, "{ invalid json", "utf8");

    await expect(readWorkspaceSettings(userDataPath, "ws-broken")).rejects.toHaveProperty("name", "CorruptWorkspaceSettingsError");
    const files = await readdir(path.dirname(settingsPath));

    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^ws-broken\.corrupt-\d+\.json$/);
  });

  it("未知の将来schemaVersionは旧形式として誤読せず元ファイルを残す", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = getWorkspaceSettingsPath(userDataPath, "ws-future");
    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, JSON.stringify({
      schemaVersion: 999,
      charts: defaultCharts,
      pinnedPaths: [],
      workspacePath: "/Users/test/future"
    }), "utf8");

    await expect(readWorkspaceSettings(userDataPath, "ws-future")).rejects.toHaveProperty("name", "UnsupportedWorkspaceSettingsVersionError");
    await expect(readdir(path.dirname(settingsPath))).resolves.toEqual([path.basename(settingsPath)]);
  });

  it("オブジェクトではないワークスペース設定ファイルでも初期設定で読み込める", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = getWorkspaceSettingsPath(userDataPath, "ws-array");
    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, "[]", "utf8");

    const settings = await readWorkspaceSettings(userDataPath, "ws-array");

    expect(settings.pinnedPaths).toEqual([]);
    expect(settings.charts).toEqual(defaultCharts);
  });

  it("設定ファイルのパスはworkspaceId別になる", () => {
    const p1 = getWorkspaceSettingsPath("/userData", "ws-1");
    const p2 = getWorkspaceSettingsPath("/userData", "ws-2");

    expect(p1).not.toBe(p2);
    expect(p1).toContain("ws-1");
    expect(p2).toContain("ws-2");
  });

  it("危険なworkspaceIdではワークスペース別設定ファイルのパスを作らない", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);

    expect(() => getWorkspaceSettingsPath(userDataPath, "../outside")).toThrow("Invalid workspace settings id.");
    expect(() => getWorkspaceSettingsPath(userDataPath, "folder/ws")).toThrow("Invalid workspace settings id.");
    await expect(readWorkspaceSettings(userDataPath, "../outside")).resolves.toEqual({
      chronicleCalendars: defaultChronicleCalendars,
      charts: defaultCharts,
      pinnedPaths: [],
      workspacePath: ""
    });
    await expect(writeWorkspaceSettings(userDataPath, "../outside", {
      chronicleCalendars: defaultChronicleCalendars,
      charts: defaultCharts,
      pinnedPaths: [],
      workspacePath: "/tmp/workspace"
    })).rejects.toThrow("Invalid workspace settings id.");
  });

  it("同時更新は更新ヘルパーで直列化される", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);
    await writeWorkspaceSettings(userDataPath, "ws-race", {
      chronicleCalendars: defaultChronicleCalendars,
      charts: defaultCharts,
      pinnedPaths: [],
      workspacePath: ""
    });

    const firstUpdate = updateWorkspaceSettings(userDataPath, "ws-race", async (settings) => {
      await delay(30);
      return {
        ...settings,
        pinnedPaths: ["notes/one.md"]
      };
    });
    const secondUpdate = updateWorkspaceSettings(userDataPath, "ws-race", (settings) => ({
      ...settings,
      workspacePath: "/Users/test/notes"
    }));

    await Promise.all([firstUpdate, secondUpdate]);
    const loaded = await readWorkspaceSettings(userDataPath, "ws-race");

    expect(loaded.pinnedPaths).toEqual(["notes/one.md"]);
    expect(loaded.workspacePath).toBe("/Users/test/notes");
  });

  it("移行読み込みと同時更新で更新値が上書きされない", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = getWorkspaceSettingsPath(userDataPath, "ws-legacy-concurrent");
    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, JSON.stringify({
      schemaVersion: 0,
      chronicleCalendars: defaultChronicleCalendars,
      charts: defaultCharts,
      pinnedPaths: [],
      workspacePath: "/Users/test/legacy"
    }), "utf8");

    const update = updateWorkspaceSettings(userDataPath, "ws-legacy-concurrent", async (settings) => {
      await delay(40);
      return {
        ...settings,
        workspacePath: "/Users/test/new"
      };
    });
    const readWhileUpdating = (async () => {
      await delay(10);
      return readWorkspaceSettings(userDataPath, "ws-legacy-concurrent");
    })();

    await Promise.all([update, readWhileUpdating]);

    const raw = JSON.parse(await readFile(settingsPath, "utf8")) as Record<string, unknown>;
    expect(raw.schemaVersion).toBe(1);
    expect(raw.workspacePath).toBe("/Users/test/new");
  });
});
