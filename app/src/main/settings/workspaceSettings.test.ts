import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  defaultGanttCharts,
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
    expect(settings.ganttCharts).toEqual(defaultGanttCharts);
    expect(settings.workspacePath).toBe("");
  });

  it("書き込んだ設定を読み込める", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);

    await writeWorkspaceSettings(userDataPath, "ws-1", {
      ganttCharts: [
        { filePaths: ["history/kamakura.md"], id: "chronicle", name: "歴史", source: "chronicle" }
      ],
      pinnedPaths: ["notes/readme.md", "docs"],
      workspacePath: "/Users/test/notes"
    });

    const settings = await readWorkspaceSettings(userDataPath, "ws-1");
    expect(settings.ganttCharts).toEqual([
      { filePaths: ["history/kamakura.md"], id: "chronicle", name: "Chronicle", source: "chronicle" }
    ]);
    expect(settings.pinnedPaths).toEqual(["notes/readme.md", "docs"]);
    expect(settings.workspacePath).toBe("/Users/test/notes");
  });

  it("設定ファイルのパスはworkspaceId別になる", () => {
    const p1 = getWorkspaceSettingsPath("/userData", "ws-1");
    const p2 = getWorkspaceSettingsPath("/userData", "ws-2");

    expect(p1).not.toBe(p2);
    expect(p1).toContain("ws-1");
    expect(p2).toContain("ws-2");
  });
});
