import type { UpdateTimelineChartEntryInput, CardbookTimelineChart } from "../shared/ipc";
import type { RelicResult } from "../shared/result";
import type { TimelineEntryFallbackApi } from "./timelineChartApi";
import { updateTimelineFrontmatter } from "./timelineChartFrontmatter";

export async function updateTimelineEntryFallback(
  input: UpdateTimelineChartEntryInput,
  relic: TimelineEntryFallbackApi
): Promise<RelicResult<CardbookTimelineChart[]>> {
  const card = await relic.readMarkdownCard({ path: input.path });

  if (!card.ok) return { error: card.error, ok: false };

  const content = updateTimelineFrontmatter(card.value.content, input);
  const write = await relic.writeMarkdownCard({ content, path: input.path });

  if (!write.ok) return { error: write.error, ok: false };

  const charts = await relic.getCardbookTimeline();

  if (!charts.ok) return { error: charts.error, ok: false };

  return { ok: true, value: charts.value };
}
