import type { UpdateGanttChartEntryInput, WorkspaceGanttChart } from "../shared/ipc";
import type { RelicResult } from "../shared/result";
import { updateChartFrontmatterContent } from "../shared/chartFrontmatterUpdate";
import type { GanttChartEntryFallbackApi } from "./ganttChartApi";

export async function updateGanttChartEntryFallback(
  input: UpdateGanttChartEntryInput,
  relic: GanttChartEntryFallbackApi
): Promise<RelicResult<WorkspaceGanttChart[]>> {
  const file = await relic.readMarkdownFile({ path: input.path });

  if (!file.ok) return { error: file.error, ok: false };

  const calendars = typeof relic.getWorkspaceChronicleCalendars === "function"
    ? await relic.getWorkspaceChronicleCalendars()
    : null;

  if (calendars && !calendars.ok) return { error: calendars.error, ok: false };

  const content = updateChartFrontmatterContent(file.value.content, input, calendars?.value);

  if (!content.ok) return { error: content.error, ok: false };

  const write = await relic.writeMarkdownFile({ content: content.value, path: input.path });

  if (!write.ok) return { error: write.error, ok: false };

  const charts = await relic.getWorkspaceChronicle();

  if (!charts.ok) return { error: charts.error, ok: false };

  return { ok: true, value: charts.value };
}
