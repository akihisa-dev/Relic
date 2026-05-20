import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { GanttChartEntry, GanttChartSettings, UpdateGanttChartEntryInput, WorkspaceGanttChart } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import {
  collectGanttEntriesForMarkdown,
  sortChronicleEntries,
  updateChronicleDataForChartEdit
} from "./chronicleData";
import { readWorkspaceFileTree } from "./fileTree";
import { updateFrontmatter } from "./frontmatter";
import { resolveWorkspaceRelativePath } from "./paths";

export { extractChronicleRange } from "./chronicleData";

export async function readWorkspaceChronicle(
  workspacePath: string,
  charts: GanttChartSettings[]
): Promise<RelicResult<WorkspaceGanttChart[]>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const entriesBySource: Record<GanttChartSettings["source"], GanttChartEntry[]> = {
      chronicle: []
    };

    for (const relativePath of collectMarkdownPaths(fileTree)) {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");
      const fileEntries = collectGanttEntriesForMarkdown(relativePath, content);
      entriesBySource.chronicle.push(...fileEntries.chronicle);
    }

    const sortedEntriesBySource = {
      chronicle: sortChronicleEntries(entriesBySource.chronicle)
    };

    return ok(charts.map((chart) => ({
      ...chart,
      entries: sortedEntriesBySource[chart.source]
    })));
  } catch (error) {
    return fail(
      "CHRONICLE_READ_FAILED",
      "年表を読み込めませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function updateWorkspaceGanttChartEntry(
  workspacePath: string,
  charts: GanttChartSettings[],
  input: UpdateGanttChartEntryInput
): Promise<RelicResult<WorkspaceGanttChart[]>> {
  try {
    const absolutePath = resolveWorkspaceRelativePath(workspacePath, input.path);

    if (!absolutePath.ok) {
      return absolutePath;
    }

    if (path.extname(absolutePath.value) !== ".md") {
      return fail("GANTT_ENTRY_NOT_MARKDOWN", "Markdown形式のカード以外は更新できません。");
    }

    const content = await readFile(absolutePath.value, "utf8");
    const nextContent = updateFrontmatter(content, (data) =>
      updateChronicleDataForChartEdit(data, input)
    );

    await writeFile(absolutePath.value, nextContent, "utf8");

    return readWorkspaceChronicle(workspacePath, charts);
  } catch (error) {
    return fail(
      "GANTT_ENTRY_UPDATE_FAILED",
      "Chronicleの変更をカードへ保存できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}
