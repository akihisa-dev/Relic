import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { TimelineChartEntry, TimelineChartSettings, UpdateTimelineChartEntryInput, CardbookTimelineChart } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownCardPaths } from "../../shared/cardbookTree";
import {
  collectTimelineEntriesForMarkdown,
  sortTimelineEntries,
  updateTimelineDataForChartEdit
} from "./timelineData";
import { readCardbookCardTree } from "./cardTree";
import { updateFrontmatter } from "./frontmatter";
import { resolveCardbookRelativePath } from "./paths";

export { extractTimelineRange } from "./timelineData";

export async function readCardbookTimeline(
  cardbookPath: string,
  charts: TimelineChartSettings[]
): Promise<RelicResult<CardbookTimelineChart[]>> {
  try {
    const cardTree = await readCardbookCardTree(cardbookPath);
    const entriesBySource: Record<TimelineChartSettings["source"], TimelineChartEntry[]> = {
      timeline: []
    };

    for (const relativePath of collectMarkdownCardPaths(cardTree)) {
      const absolutePath = resolveCardbookRelativePath(cardbookPath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");
      const cardEntries = collectTimelineEntriesForMarkdown(relativePath, content);
      entriesBySource.timeline.push(...cardEntries.timeline);
    }

    const sortedEntriesBySource = {
      timeline: sortTimelineEntries(entriesBySource.timeline)
    };

    return ok(charts.map((chart) => ({
      ...chart,
      entries: sortedEntriesBySource[chart.source]
    })));
  } catch (error) {
    return fail(
      "TIMELINE_READ_FAILED",
      "年表を読み込めませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function updateCardbookTimelineChartEntry(
  cardbookPath: string,
  charts: TimelineChartSettings[],
  input: UpdateTimelineChartEntryInput
): Promise<RelicResult<CardbookTimelineChart[]>> {
  try {
    const absolutePath = resolveCardbookRelativePath(cardbookPath, input.path);

    if (!absolutePath.ok) {
      return absolutePath;
    }

    if (path.extname(absolutePath.value) !== ".md") {
      return fail("TIMELINE_ENTRY_NOT_MARKDOWN", "Markdown形式のカード以外は更新できません。");
    }

    const content = await readFile(absolutePath.value, "utf8");
    const nextContent = updateFrontmatter(content, (data) =>
      updateTimelineDataForChartEdit(data, input)
    );

    await writeFile(absolutePath.value, nextContent, "utf8");

    return readCardbookTimeline(cardbookPath, charts);
  } catch (error) {
    return fail(
      "TIMELINE_ENTRY_UPDATE_FAILED",
      "Timelineの変更をカードへ保存できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}
