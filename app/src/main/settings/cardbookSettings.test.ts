import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  defaultTimelineCharts,
  getCardbookSettingsPath,
  readCardbookSettings,
  writeCardbookSettings
} from "./cardbookSettings";

describe("cardbookSettings", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((p) => rm(p, { force: true, recursive: true }))
    );
  });

  it("設定カードがない場合はデフォルトを返す", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);

    const settings = await readCardbookSettings(userDataPath, "cardbook-id");

    expect(settings.pinnedPaths).toEqual([]);
    expect(settings.timelineCharts).toEqual(defaultTimelineCharts);
    expect(settings.cardbookPath).toBe("");
  });

  it("書き込んだ設定を読み込める", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-settings-"));
    temporaryPaths.push(userDataPath);

    await writeCardbookSettings(userDataPath, "ws-1", {
      timelineCharts: [
        { cardPaths: ["history/kamakura.md"], id: "timeline", name: "歴史", source: "timeline" }
      ],
      pinnedPaths: ["notes/readme.md", "docs"],
      cardbookPath: "/Users/test/notes"
    });

    const settings = await readCardbookSettings(userDataPath, "ws-1");
    expect(settings.timelineCharts).toEqual([
      { cardPaths: ["history/kamakura.md"], id: "timeline", name: "Timeline", source: "timeline" }
    ]);
    expect(settings.pinnedPaths).toEqual(["notes/readme.md", "docs"]);
    expect(settings.cardbookPath).toBe("/Users/test/notes");
  });

  it("設定カードのパスはcardbookId別になる", () => {
    const p1 = getCardbookSettingsPath("/userData", "ws-1");
    const p2 = getCardbookSettingsPath("/userData", "ws-2");

    expect(p1).not.toBe(p2);
    expect(p1).toContain("ws-1");
    expect(p2).toContain("ws-2");
  });
});
