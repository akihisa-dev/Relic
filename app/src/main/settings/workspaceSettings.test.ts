import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { defaultChronicleCalendars } from "../../shared/ipc";
import {
  defaultCharts,
  getWorkspaceSettingsPath,
  readWorkspaceSettings,
  writeWorkspaceSettings
} from "./workspaceSettings";

describe("workspaceSettings", () => {
  const temporaryPaths: string[] = [];

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
        { id: "chronicle0", name: "王国暦" },
        { id: "chronicle1", name: "帝国暦", startYear: 100 },
        { id: "chronicle2", name: "未開始暦" },
        { id: "chronicle3", name: "", startYear: 200 }
      ],
      charts: [
        { filePaths: ["history/kamakura.md"], id: "chronicle", name: "歴史", source: "chronicle" },
        { filePaths: [], id: "schedule", name: "予定", source: "date" }
      ],
      pinnedPaths: ["notes/readme.md", "docs"],
      workspacePath: "/Users/test/notes"
    });

    const settings = await readWorkspaceSettings(userDataPath, "ws-1");
    expect(settings.chronicleCalendars).toEqual([
      { id: "chronicle0", name: "王国暦" },
      { id: "chronicle1", name: "帝国暦", startYear: 100 },
      { id: "chronicle2", name: "未開始暦" },
      { id: "chronicle3", name: "", startYear: 200 }
    ]);
    expect(settings.charts).toEqual([
      { filePaths: ["history/kamakura.md"], id: "chronicle", name: "chronicle", source: "chronicle" },
      { filePaths: [], id: "date", name: "date", source: "date" }
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

  it("旧ganttChartsキーをchartsとして読み込む", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = getWorkspaceSettingsPath(userDataPath, "ws-legacy");

    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, JSON.stringify({
      chronicleCalendars: defaultChronicleCalendars,
      ganttCharts: [
        { filePaths: ["history.md"], id: "chronicle", name: "歴史", source: "chronicle" },
        { filePaths: ["schedule.md"], id: "date", name: "予定", source: "date" }
      ],
      pinnedPaths: [],
      workspacePath: "/Users/test/legacy"
    }), "utf8");

    const settings = await readWorkspaceSettings(userDataPath, "ws-legacy");

    expect(settings.charts).toEqual([
      { filePaths: ["history.md"], id: "chronicle", name: "chronicle", source: "chronicle" },
      { filePaths: ["schedule.md"], id: "date", name: "date", source: "date" }
    ]);
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

    expect(raw.charts).toEqual(defaultCharts);
    expect(raw.ganttCharts).toBeUndefined();
    await expect(readdir(path.dirname(getWorkspaceSettingsPath(userDataPath, "ws-new")))).resolves.toEqual([
      path.basename(getWorkspaceSettingsPath(userDataPath, "ws-new"))
    ]);
  });

  it("壊れたワークスペース設定ファイルでも初期設定で読み込める", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);
    const settingsPath = getWorkspaceSettingsPath(userDataPath, "ws-broken");
    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, "{ invalid json", "utf8");

    const settings = await readWorkspaceSettings(userDataPath, "ws-broken");

    expect(settings.pinnedPaths).toEqual([]);
    expect(settings.chronicleCalendars).toEqual(defaultChronicleCalendars);
    expect(settings.charts).toEqual(defaultCharts);
    expect(settings.workspacePath).toBe("");
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
});
