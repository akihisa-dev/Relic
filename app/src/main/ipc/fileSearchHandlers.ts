import {
  applyUnlinkedReferenceChannel,
  type ApplyUnlinkedReferenceInput,
  applySearchAndReplaceChannel,
  getBacklinksChannel,
  type GetBacklinksInput,
  getUnlinkedReferencesChannel,
  type GetUnlinkedReferencesInput,
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
import { handleLocalizedIpc } from "./localizedIpcHandler";
import { workspaceSearchRequestCoordinator } from "../files/searchRequestCoordinator";
import { applyUnlinkedReference, readUnlinkedReferences } from "../files/unlinkedReferences";
import { invalidateWorkspaceData } from "../files/workspaceDataInvalidation";
import { workspaceDataProvider } from "../files/workspaceDataProvider";
import { normalizeSearchWorkspaceInput } from "../compatibility/searchInputCompatibility";
import { ipcErrorDetails, withActiveWorkspaceContext } from "./activeWorkspace";
import {
  isPathInput,
  isApplyUnlinkedReferenceInput,
  isReplaceInFileInput,
  isSearchAndReplaceInput
} from "./fileHandlerValidators";

export function registerFileSearchHandlers(): void {
  handleLocalizedIpc(searchWorkspaceChannel, async (_event, ...args: unknown[]) => {
    try {
      const searchInput = normalizeSearchWorkspaceInput(args.length === 1 ? args[0] : args);

      if (!searchInput) {
        return fail("SEARCH_INVALID_INPUT", "検索リクエストが正しくありません。");
      }

      return await withActiveWorkspaceContext(
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
              const data = await workspaceDataProvider.get({
                maxSearchFileBytes: workspaceSearchMaxFileBytes,
                userDataPath: context.userDataPath,
                workspaceId: context.activeWorkspace.id,
                workspacePath: context.activeWorkspace.path
              });

              return searchWorkspace(
                data.workspacePath,
                searchInput.query,
                searchInput.mode,
                searchInput.frontmatterField,
                {
                  ...data.options,
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

  handleLocalizedIpc(readMarkdownFileChannel, async (_event, input: ReadMarkdownFileInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("FILE_READ_INVALID_INPUT", "ファイルパスを指定してください。");
      }

      return await withActiveWorkspaceContext(
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

  handleLocalizedIpc(getBacklinksChannel, async (_event, input: GetBacklinksInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("BACKLINKS_INVALID_INPUT", "バックリンクを確認するファイルを指定してください。");
      }

      return await withActiveWorkspaceContext(
        { code: "BACKLINKS_READ_FAILED", message: "バックリンクを読み込めませんでした。" },
        async (context) => {
          const data = await workspaceDataProvider.get({
            userDataPath: context.userDataPath,
            workspaceId: context.activeWorkspace.id,
            workspacePath: context.activeWorkspace.path
          });

          return readBacklinks(data.workspacePath, input.path, data.options);
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

  handleLocalizedIpc(getUnlinkedReferencesChannel, async (_event, input: GetUnlinkedReferencesInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("UNLINKED_REFERENCES_INVALID_INPUT", "未リンク参照を確認するファイルを指定してください。");
      }

      return await withActiveWorkspaceContext(
        { code: "UNLINKED_REFERENCES_READ_FAILED", message: "未リンク参照を読み込めませんでした。" },
        async (context) => {
          const data = await workspaceDataProvider.get({
            userDataPath: context.userDataPath,
            workspaceId: context.activeWorkspace.id,
            workspacePath: context.activeWorkspace.path
          });

          return readUnlinkedReferences(data.workspacePath, input.path, data.options);
        }
      );
    } catch (error) {
      return fail(
        "UNLINKED_REFERENCES_READ_FAILED",
        "未リンク参照を読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  handleLocalizedIpc(applyUnlinkedReferenceChannel, async (_event, input: ApplyUnlinkedReferenceInput) => {
    try {
      if (!isApplyUnlinkedReferenceInput(input)) {
        return fail("UNLINKED_REFERENCE_INVALID_INPUT", "リンク化する未リンク参照を指定してください。");
      }

      return await withActiveWorkspaceContext(
        { code: "UNLINKED_REFERENCE_APPLY_FAILED", message: "未リンク参照をリンク化できませんでした。" },
        async (context) => {
          const result = await applyUnlinkedReference(context.activeWorkspace.path, input);
          if (result.ok) {
            invalidateWorkspaceData(context.activeWorkspace.id);
          }

          return result;
        }
      );
    } catch (error) {
      return fail(
        "UNLINKED_REFERENCE_APPLY_FAILED",
        "未リンク参照をリンク化できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  handleLocalizedIpc(replaceInFileChannel, async (_event, input: ReplaceInFileInput) => {
    try {
      if (!isReplaceInFileInput(input)) {
        return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
      }

      return await withActiveWorkspaceContext(
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
            invalidateWorkspaceData(context.activeWorkspace.id);
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

  handleLocalizedIpc(searchAndReplaceChannel, async (_event, input: SearchAndReplaceInput) => {
    try {
      if (!isSearchAndReplaceInput(input)) {
        return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
      }

      return await withActiveWorkspaceContext(
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

  handleLocalizedIpc(applySearchAndReplaceChannel, async (_event, input: SearchAndReplaceInput) => {
    try {
      if (!isSearchAndReplaceInput(input)) {
        return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
      }

      return await withActiveWorkspaceContext(
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
            invalidateWorkspaceData(context.activeWorkspace.id);
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
