import { ipcMain } from "electron";

import {
  generateTableOfContentsChannel,
  generateTitleListChannel,
  mergeCardsChannel,
  splitCardByHeadingChannel
} from "../../shared/ipc";
import { fail, type RelicResult } from "../../shared/result";
import { ipcErrorDetails } from "./activeCardbook";
import {
  generateTableOfContents,
  generateTitleList,
  mergeCards,
  splitCardByHeading
} from "./toolActions";
import {
  isGenerateTableOfContentsInput,
  isGenerateTitleListInput,
  isMergeCardsInput,
  isSplitCardByHeadingInput
} from "./toolHandlerValidators";

export function registerToolHandlers(): void {
  ipcMain.handle(
    mergeCardsChannel,
    async (_event, input: unknown): Promise<RelicResult<string>> => {
      try {
        if (!isMergeCardsInput(input)) {
          return fail("MERGE_INVALID_INPUT", "マージ条件が無効です。");
        }

        return await mergeCards(input);
      } catch (error) {
        return fail("MERGE_FAILED", "カードのマージに失敗しました。", ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    splitCardByHeadingChannel,
    async (_event, input: unknown): Promise<RelicResult<string[]>> => {
      try {
        if (!isSplitCardByHeadingInput(input)) {
          return fail("SPLIT_INVALID_INPUT", "分割条件が無効です。");
        }

        return await splitCardByHeading(input);
      } catch (error) {
        return fail("SPLIT_FAILED", "カードの分割に失敗しました。", ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    generateTitleListChannel,
    async (_event, input: unknown): Promise<RelicResult<string>> => {
      try {
        if (!isGenerateTitleListInput(input)) {
          return fail("TITLE_LIST_INVALID_INPUT", "タイトル一覧の生成条件が無効です。");
        }

        return await generateTitleList(input);
      } catch (error) {
        return fail("TITLE_LIST_FAILED", "タイトル一覧の生成に失敗しました。", ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    generateTableOfContentsChannel,
    async (_event, input: unknown): Promise<RelicResult<string>> => {
      try {
        if (!isGenerateTableOfContentsInput(input)) {
          return fail("TOC_INVALID_INPUT", "目次の生成条件が無効です。");
        }

        return await generateTableOfContents(input);
      } catch (error) {
        return fail("TOC_FAILED", "目次の生成に失敗しました。", ipcErrorDetails(error));
      }
    }
  );
}
