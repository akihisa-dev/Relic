import { ipcMain } from "electron";

import {
  applySearchAndReplaceChannel,
  getBacklinksChannel,
  type GetBacklinksInput,
  readMarkdownFileChannel,
  type ReadMarkdownFileInput,
  replaceInFileChannel,
  type ReplaceInFileInput,
  searchAndReplaceChannel,
  type SearchAndReplaceInput,
  searchWorkspaceChannel
} from "../../shared/ipc";
import { isReservedFrontmatterFieldName } from "../../shared/frontmatterFields";
import { fail, ok } from "../../shared/result";
import { readBacklinks } from "../files/backlinks";
import { readMarkdownFile } from "../files/markdownFiles";
import { applySearchAndReplace, replaceInFile, searchAndReplace } from "../files/replace";
import { searchWorkspace, workspaceSearchMaxFileBytes } from "../files/search";
import { workspaceSearchRequestCoordinator } from "../files/searchRequestCoordinator";
import {
  getWorkspaceDerivedDataSnapshot,
  invalidateWorkspaceDerivedData
} from "../files/workspaceDerivedDataSession";
import { getWorkspaceFileIndexCachePath } from "../files/workspaceFileIndex";
import { ipcErrorDetails, withActiveWorkspaceContext } from "./activeWorkspace";
import {
  isPathInput,
  isReplaceInFileInput,
  isSearchAndReplaceInput,
  normalizeSearchWorkspaceInput
} from "./fileHandlerValidators";

export function registerFileSearchHandlers(): void {
  ipcMain.handle(searchWorkspaceChannel, async (_event, ...args: unknown[]) => {
    try {
      const searchInput = normalizeSearchWorkspaceInput(args.length === 1 ? args[0] : args);

      if (!searchInput) {
        return fail("SEARCH_INVALID_INPUT", "検索リクエストが正しくありません。");
      }

      return withActiveWorkspaceContext(
        { code: "SEARCH_FAILED", message: "検索できませんでした。" },
        async (context) => {
          if (
            searchInput.mode === "frontmatter" &&
            searchInput.frontmatterField?.trim() &&
            !isRegisteredFrontmatterSearchField(
              searchInput.frontmatterField,
              context.settings.userDefinedFields
            )
          ) {
            return ok({ results: [], skippedLongLines: 0, skippedLargeFiles: 0, truncated: false });
          }

          return workspaceSearchRequestCoordinator.run(
            context.activeWorkspace.id,
            searchRequestKey(searchInput),
            async ({ shouldContinue }) => {
              const cachePath = getWorkspaceFileIndexCachePath(
                context.userDataPath,
                context.activeWorkspace.id
              );
              const snapshot = await getWorkspaceDerivedDataSnapshot({
                cachePath,
                maxSearchFileBytes: workspaceSearchMaxFileBytes,
                workspaceId: context.activeWorkspace.id,
                workspacePath: context.activeWorkspace.path
              });

              return searchWorkspace(
                context.activeWorkspace.path,
                searchInput.query,
                searchInput.mode,
                searchInput.frontmatterField,
                {
                  cachePath,
                  fileIndex: snapshot.fileIndex,
                  parseCache: snapshot.parseCache,
                  shouldContinue
                }
              );
            }
          );
        }
      );
    } catch (error) {
      return fail(
        "SEARCH_FAILED",
        "検索できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(readMarkdownFileChannel, async (_event, input: ReadMarkdownFileInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("FILE_READ_INVALID_INPUT", "ファイルパスを指定してください。");
      }

      return withActiveWorkspaceContext(
        { code: "FILE_READ_FAILED", message: "ファイルを読み込めませんでした。" },
        async (context) => readMarkdownFile(context.activeWorkspace.path, input.path)
      );
    } catch (error) {
      return fail(
        "FILE_READ_FAILED",
        "ファイルを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(getBacklinksChannel, async (_event, input: GetBacklinksInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("BACKLINKS_INVALID_INPUT", "バックリンクを確認するファイルを指定してください。");
      }

      return withActiveWorkspaceContext(
        { code: "BACKLINKS_READ_FAILED", message: "バックリンクを読み込めませんでした。" },
        async (context) => {
          const cachePath = getWorkspaceFileIndexCachePath(
            context.userDataPath,
            context.activeWorkspace.id
          );
          const snapshot = await getWorkspaceDerivedDataSnapshot({
            cachePath,
            workspaceId: context.activeWorkspace.id,
            workspacePath: context.activeWorkspace.path
          });

          return readBacklinks(context.activeWorkspace.path, input.path, {
            cachePath,
            fileIndex: snapshot.fileIndex,
            parseCache: snapshot.parseCache
          });
        }
      );
    } catch (error) {
      return fail(
        "BACKLINKS_READ_FAILED",
        "バックリンクを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(replaceInFileChannel, async (_event, input: ReplaceInFileInput) => {
    try {
      if (!isReplaceInFileInput(input)) {
        return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
      }

      return withActiveWorkspaceContext(
        { code: "REPLACE_FAILED", message: "置換できませんでした。" },
        async (context) => {
          const result = await replaceInFile(
            context.activeWorkspace.path,
            input.path,
            input.searchQuery,
            input.replacement,
            input.isRegex
          );
          if (result.ok) {
            invalidateWorkspaceDerivedData(context.activeWorkspace.id);
            workspaceSearchRequestCoordinator.invalidate(context.activeWorkspace.id);
          }
          return result;
        }
      );
    } catch (error) {
      return fail(
        "REPLACE_FAILED",
        "置換できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(searchAndReplaceChannel, async (_event, input: SearchAndReplaceInput) => {
    try {
      if (!isSearchAndReplaceInput(input)) {
        return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
      }

      return withActiveWorkspaceContext(
        { code: "REPLACE_FAILED", message: "置換プレビューを生成できませんでした。" },
        async (context) => searchAndReplace(
          context.activeWorkspace.path,
          input.searchQuery,
          input.replacement,
          input.isRegex
        )
      );
    } catch (error) {
      return fail(
        "REPLACE_FAILED",
        "置換プレビューを生成できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(applySearchAndReplaceChannel, async (_event, input: SearchAndReplaceInput) => {
    try {
      if (!isSearchAndReplaceInput(input)) {
        return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
      }

      return withActiveWorkspaceContext(
        { code: "REPLACE_FAILED", message: "一括置換できませんでした。" },
        async (context) => {
          const result = await applySearchAndReplace(
            context.activeWorkspace.path,
            input.searchQuery,
            input.replacement,
            input.isRegex,
            undefined,
            input.expectedFileSnapshots
          );
          if (result.ok) {
            invalidateWorkspaceDerivedData(context.activeWorkspace.id);
            workspaceSearchRequestCoordinator.invalidate(context.activeWorkspace.id);
          }
          return result;
        }
      );
    } catch (error) {
      return fail(
        "REPLACE_FAILED",
        "一括置換できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });
}

function isRegisteredFrontmatterSearchField(
  field: string,
  userDefinedFields: Array<{ name: string }>
): boolean {
  const normalizedField = field.trim();

  return isReservedFrontmatterFieldName(normalizedField) ||
    userDefinedFields.some((candidate) => candidate.name === normalizedField);
}

function searchRequestKey(input: {
  frontmatterField?: string;
  mode: string;
  query: string;
}): string {
  return JSON.stringify({
    frontmatterField: input.frontmatterField?.trim() ?? "",
    mode: input.mode,
    query: input.query.trim()
  });
}
