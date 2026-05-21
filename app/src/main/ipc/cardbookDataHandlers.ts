import { ipcMain } from "electron";

import {
  getFrontmatterValueCandidatesChannel,
  getCardbookAliasesChannel,
  getCardbookTimelineChannel,
  getCardbookTagsChannel,
  saveCardbookTimelineChartsChannel,
  updateTimelineChartEntryChannel
} from "../../shared/ipc";
import { fail } from "../../shared/result";
import { readCardbookAliases } from "../cards/aliases";
import { readCardbookTimeline, updateCardbookTimelineChartEntry } from "../cards/timeline";
import { readFrontmatterValueCandidates } from "../cards/frontmatterCandidates";
import { readCardbookTags } from "../cards/tags";
import { readCardbookSettings, writeCardbookSettings } from "../settings/cardbookSettings";
import { getActiveCardbookContext, ipcErrorDetails } from "./activeCardbook";
import {
  isTimelineChartsInput,
  isUpdateTimelineChartEntryInput
} from "./cardbookHandlerValidators";

export function registerCardbookDataHandlers(): void {
  ipcMain.handle(getCardbookTagsChannel, async () => {
    try {
      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      return readCardbookTags(context.value.activeCardbook.path);
    } catch (error) {
      return fail(
        "TAGS_READ_FAILED",
        "タグを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(getFrontmatterValueCandidatesChannel, async () => {
    try {
      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      return readFrontmatterValueCandidates(context.value.activeCardbook.path);
    } catch (error) {
      return fail(
        "FRONTMATTER_VALUE_CANDIDATES_READ_FAILED",
        "プロパティ候補を読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(getCardbookAliasesChannel, async () => {
    try {
      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      return readCardbookAliases(context.value.activeCardbook.path);
    } catch (error) {
      return fail(
        "CARDBOOK_ALIASES_FAILED",
        "別名を読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(getCardbookTimelineChannel, async () => {
    try {
      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      const cardbookSettings = await readCardbookSettings(
        context.value.userDataPath,
        context.value.activeCardbook.id
      );
      return readCardbookTimeline(context.value.activeCardbook.path, cardbookSettings.timelineCharts);
    } catch (error) {
      return fail(
        "CARDBOOK_TIMELINE_FAILED",
        "年表を読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(saveCardbookTimelineChartsChannel, async (_event, input: unknown) => {
    try {
      if (!isTimelineChartsInput(input)) {
        return fail("INVALID_TIMELINE_CHARTS", "暦設定が正しくありません。");
      }

      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      const cardbookSettings = await readCardbookSettings(
        context.value.userDataPath,
        context.value.activeCardbook.id
      );
      await writeCardbookSettings(context.value.userDataPath, context.value.activeCardbook.id, {
        ...cardbookSettings,
        timelineCharts: input.map((chart) => ({
          cardPaths: chart.cardPaths,
          id: chart.id.trim(),
          name: chart.name.trim(),
          source: chart.source
        }))
      });

      return readCardbookTimeline(context.value.activeCardbook.path, input);
    } catch (error) {
      return fail(
        "CARDBOOK_TIMELINE_SAVE_FAILED",
        "暦設定を保存できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(updateTimelineChartEntryChannel, async (_event, input: unknown) => {
    try {
      if (!isUpdateTimelineChartEntryInput(input)) {
        return fail("TIMELINE_ENTRY_UPDATE_INVALID_INPUT", "Timelineの変更内容が正しくありません。");
      }

      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      const cardbookSettings = await readCardbookSettings(
        context.value.userDataPath,
        context.value.activeCardbook.id
      );
      return updateCardbookTimelineChartEntry(context.value.activeCardbook.path, cardbookSettings.timelineCharts, input);
    } catch (error) {
      return fail(
        "TIMELINE_ENTRY_UPDATE_FAILED",
        "Timelineの変更を保存できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });
}
