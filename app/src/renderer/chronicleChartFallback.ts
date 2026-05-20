import type { UpdateGanttChartEntryInput, WorkspaceGanttChart } from "../shared/ipc";
import type { RelicResult } from "../shared/result";
import type { ChronicleEntryFallbackApi } from "./chronicleChartApi";
import { updateChronicleFrontmatter } from "./chronicleChartFrontmatter";

export async function updateChronicleEntryFallback(
  input: UpdateGanttChartEntryInput,
  relic: ChronicleEntryFallbackApi
): Promise<RelicResult<WorkspaceGanttChart[]>> {
  const file = await relic.readMarkdownFile({ path: input.path });

  if (!file.ok) return { error: file.error, ok: false };

  const content = updateChronicleFrontmatter(file.value.content, input);
  const write = await relic.writeMarkdownFile({ content, path: input.path });

  if (!write.ok) return { error: write.error, ok: false };

  const charts = await relic.getWorkspaceChronicle();

  if (!charts.ok) return { error: charts.error, ok: false };

  return { ok: true, value: charts.value };
}
