import { ipcMain } from "electron";

import {
  generateTableOfContentsChannel,
  type GenerateTableOfContentsInput,
  generateTitleListChannel,
  type GenerateTitleListInput,
  mergeFilesChannel,
  type MergeFilesInput,
  splitFileByHeadingChannel,
  type SplitFileByHeadingInput
} from "../../shared/ipc";
import { fail, type RelicResult } from "../../shared/result";
import { ipcErrorDetails } from "./activeWorkspace";
import {
  generateTableOfContents,
  generateTitleList,
  mergeFiles,
  splitFileByHeading
} from "./toolActions";

export function registerToolHandlers(): void {
  ipcMain.handle(
    mergeFilesChannel,
    async (_event, input: MergeFilesInput): Promise<RelicResult<string>> => {
      try {
        return await mergeFiles(input);
      } catch (error) {
        return fail("MERGE_FAILED", "ファイルのマージに失敗しました。", ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    splitFileByHeadingChannel,
    async (_event, input: SplitFileByHeadingInput): Promise<RelicResult<string[]>> => {
      try {
        return await splitFileByHeading(input);
      } catch (error) {
        return fail("SPLIT_FAILED", "ファイルの分割に失敗しました。", ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    generateTitleListChannel,
    async (_event, input: GenerateTitleListInput): Promise<RelicResult<string>> => {
      try {
        return await generateTitleList(input);
      } catch (error) {
        return fail("TITLE_LIST_FAILED", "タイトル一覧の生成に失敗しました。", ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    generateTableOfContentsChannel,
    async (_event, input: GenerateTableOfContentsInput): Promise<RelicResult<string>> => {
      try {
        return await generateTableOfContents(input);
      } catch (error) {
        return fail("TOC_FAILED", "目次の生成に失敗しました。", ipcErrorDetails(error));
      }
    }
  );
}
