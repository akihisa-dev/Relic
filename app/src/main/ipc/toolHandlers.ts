import { ipcMain } from "electron";

import {
  generateTableOfContentsChannel,
  generateTitleListChannel,
  mergeFilesChannel,
  splitFileByHeadingChannel
} from "../../shared/ipc";
import { fail, type RelicResult } from "../../shared/result";
import { ipcErrorDetails } from "./activeWorkspace";
import {
  generateTableOfContents,
  generateTitleList,
  mergeFiles,
  splitFileByHeading
} from "./toolActions";
import {
  isGenerateTableOfContentsInput,
  isGenerateTitleListInput,
  isMergeFilesInput,
  isSplitFileByHeadingInput
} from "./toolHandlerValidators";

export function registerToolHandlers(): void {
  ipcMain.handle(
    mergeFilesChannel,
    async (_event, input: unknown): Promise<RelicResult<string>> => {
      try {
        if (!isMergeFilesInput(input)) {
          return fail("MERGE_INVALID_INPUT", "マージ条件が無効です。");
        }

        return await mergeFiles(input);
      } catch (error) {
        return fail("MERGE_FAILED", "ファイルのマージに失敗しました。", ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    splitFileByHeadingChannel,
    async (_event, input: unknown): Promise<RelicResult<string[]>> => {
      try {
        if (!isSplitFileByHeadingInput(input)) {
          return fail("SPLIT_INVALID_INPUT", "分割条件が無効です。");
        }

        return await splitFileByHeading(input);
      } catch (error) {
        return fail("SPLIT_FAILED", "ファイルの分割に失敗しました。", ipcErrorDetails(error));
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
