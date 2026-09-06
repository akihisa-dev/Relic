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
import { readMarkdownFile } from "../files/markdownFileContent";
import { applySearchAndReplace, replaceInFile, searchAndReplace } from "../files/replace";
import { searchWorkspace, workspaceSearchMaxFileBytes } from "../files/search";
import { handleLocalizedIpc } from "./localizedIpcHandler";
import { workspaceSearchRequestCoordinator } from "../files/searchRequestCoordinator";
import { applyUnlinkedReference, readUnlinkedReferences } from "../files/unlinkedReferences";
import { workspaceMutationService } from "../files/workspaceMutationService";
import { workspaceDataProvider } from "../files/workspaceDataProvider";
import { withActiveWorkspaceContext } from "./activeWorkspace";
import { isPathInput } from "./inputValidation";
import {
  isApplyUnlinkedReferenceInput,
  isReplaceInFileInput,
  isSearchAndReplaceInput,
  isSearchWorkspaceInput
} from "./searchHandlerValidators";

export function registerFileSearchHandlers(): void {
  handleLocalizedIpc(searchWorkspaceChannel, async (_event, input: unknown) => {
    if (!isSearchWorkspaceInput(input)) {
      return fail("SEARCH_INVALID_INPUT", "検索リクエストが正しくありません。");
    }

    return withActiveWorkspaceContext(
      { code: "SEARCH_FAILED", message: "検索できませんでした。" },
      async (context) => {
        if (
          input.mode === "frontmatter" &&
          input.frontmatterField?.trim() &&
          !isRegisteredFrontmatterSearchField(
            input.frontmatterField,
            context.settings.userDefinedFields
          )
        ) {
          return ok({ results: [], skippedLongLines: 0, skippedLargeFiles: 0, truncated: false });
        }

        return workspaceSearchRequestCoordinator.run(
          context.activeWorkspace.id,
          searchRequestKey(input),
          async ({ shouldContinue }) => {
            const data = await workspaceDataProvider.get({
              maxSearchFileBytes: workspaceSearchMaxFileBytes,
              userDataPath: context.userDataPath,
              workspaceId: context.activeWorkspace.id,
              workspacePath: context.activeWorkspace.path
            });

            return searchWorkspace(
              data.workspacePath,
              input.query,
              input.mode,
              input.frontmatterField,
              {
                ...data.options,
                shouldContinue
              }
            );
          }
        );
      }
    );
  });

  handleLocalizedIpc(readMarkdownFileChannel, async (_event, input: ReadMarkdownFileInput) => {
    if (!isPathInput(input)) {
      return fail("FILE_READ_INVALID_INPUT", "ファイルパスを指定してください。");
    }

    return withActiveWorkspaceContext(
      { code: "FILE_READ_FAILED", message: "ファイルを読み込めませんでした。" },
      async (context) => readMarkdownFile(context.activeWorkspace.path, input.path)
    );
  });

  handleLocalizedIpc(getBacklinksChannel, async (_event, input: GetBacklinksInput) => {
    if (!isPathInput(input)) {
      return fail("BACKLINKS_INVALID_INPUT", "バックリンクを確認するファイルを指定してください。");
    }

    return withActiveWorkspaceContext(
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
  });

  handleLocalizedIpc(getUnlinkedReferencesChannel, async (_event, input: GetUnlinkedReferencesInput) => {
    if (!isPathInput(input)) {
      return fail("UNLINKED_REFERENCES_INVALID_INPUT", "未リンク参照を確認するファイルを指定してください。");
    }

    return withActiveWorkspaceContext(
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
  });

  handleLocalizedIpc(applyUnlinkedReferenceChannel, async (_event, input: ApplyUnlinkedReferenceInput) => {
    if (!isApplyUnlinkedReferenceInput(input)) {
      return fail("UNLINKED_REFERENCE_INVALID_INPUT", "リンク化する未リンク参照を指定してください。");
    }

    return withActiveWorkspaceContext(
      { code: "UNLINKED_REFERENCE_APPLY_FAILED", message: "未リンク参照をリンク化できませんでした。" },
      async (context) => {
        return workspaceMutationService.run(
          { workspaceId: context.activeWorkspace.id, workspacePath: context.activeWorkspace.path },
          ({ workspacePath }) => applyUnlinkedReference(workspacePath, input),
          "workspace"
        );
      }
    );
  });

  handleLocalizedIpc(replaceInFileChannel, async (_event, input: ReplaceInFileInput) => {
    if (!isReplaceInFileInput(input)) {
      return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
    }

    return withActiveWorkspaceContext(
      { code: "REPLACE_FAILED", message: "置換できませんでした。" },
      async (context) => {
        return workspaceMutationService.run(
          { workspaceId: context.activeWorkspace.id, workspacePath: context.activeWorkspace.path },
          ({ workspacePath }) => replaceInFile(
            workspacePath,
            input.path,
            input.searchQuery,
            input.replacement,
            input.isRegex
          ),
          "workspace"
        );
      }
    );
  });

  handleLocalizedIpc(searchAndReplaceChannel, async (_event, input: SearchAndReplaceInput) => {
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
  });

  handleLocalizedIpc(applySearchAndReplaceChannel, async (_event, input: SearchAndReplaceInput) => {
    if (!isSearchAndReplaceInput(input)) {
      return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
    }

    return withActiveWorkspaceContext(
      { code: "REPLACE_FAILED", message: "一括置換できませんでした。" },
      async (context) => {
        return workspaceMutationService.run(
          { workspaceId: context.activeWorkspace.id, workspacePath: context.activeWorkspace.path },
          ({ workspacePath }) => applySearchAndReplace(
            workspacePath,
            input.searchQuery,
            input.replacement,
            input.isRegex,
            undefined,
            input.expectedFileSnapshots
          )
        );
      }
    );
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
