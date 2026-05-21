import { ipcMain } from "electron";

import {
  applySearchAndReplaceChannel,
  getBacklinksChannel,
  type GetBacklinksInput,
  readMarkdownCardChannel,
  type ReadMarkdownCardInput,
  replaceInCardChannel,
  type ReplaceInCardInput,
  searchAndReplaceChannel,
  type SearchAndReplaceInput,
  searchCardbookChannel
} from "../../shared/ipc";
import { fail, ok } from "../../shared/result";
import { readBacklinks } from "../cards/backlinks";
import { readMarkdownCard } from "../cards/markdownCards";
import { applySearchAndReplace, replaceInCard, searchAndReplace } from "../cards/replace";
import { searchCardbook } from "../cards/search";
import { getActiveCardbookContext, ipcErrorDetails } from "./activeCardbook";
import {
  isPathInput,
  isReplaceInCardInput,
  isSearchAndReplaceInput,
  normalizeSearchCardbookInput
} from "./cardHandlerValidators";

export function registerCardSearchHandlers(): void {
  ipcMain.handle(searchCardbookChannel, async (_event, ...args: unknown[]) => {
    try {
      const searchInput = normalizeSearchCardbookInput(args.length === 1 ? args[0] : args);

      if (!searchInput) {
        return fail("SEARCH_INVALID_INPUT", "検索リクエストが正しくありません。");
      }

      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      if (
        searchInput.mode === "frontmatter" &&
        searchInput.frontmatterField?.trim() &&
        !isRegisteredFrontmatterSearchField(
          searchInput.frontmatterField,
          context.value.settings.userDefinedFields
        )
      ) {
        return ok([]);
      }

      return searchCardbook(
        context.value.activeCardbook.path,
        searchInput.query,
        searchInput.mode,
        searchInput.frontmatterField
      );
    } catch (error) {
      return fail(
        "SEARCH_FAILED",
        "検索できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(readMarkdownCardChannel, async (_event, input: ReadMarkdownCardInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("FILE_READ_INVALID_INPUT", "カードパスを指定してください。");
      }

      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      return readMarkdownCard(context.value.activeCardbook.path, input.path);
    } catch (error) {
      return fail(
        "FILE_READ_FAILED",
        "カードを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(getBacklinksChannel, async (_event, input: GetBacklinksInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("BACKLINKS_INVALID_INPUT", "バックリンクを確認するカードを指定してください。");
      }

      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      return readBacklinks(context.value.activeCardbook.path, input.path);
    } catch (error) {
      return fail(
        "BACKLINKS_READ_FAILED",
        "バックリンクを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(replaceInCardChannel, async (_event, input: ReplaceInCardInput) => {
    try {
      if (!isReplaceInCardInput(input)) {
        return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
      }

      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      return replaceInCard(
        context.value.activeCardbook.path,
        input.path,
        input.searchQuery,
        input.replacement,
        input.isRegex
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

      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      return searchAndReplace(
        context.value.activeCardbook.path,
        input.searchQuery,
        input.replacement,
        input.isRegex
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

      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      return applySearchAndReplace(
        context.value.activeCardbook.path,
        input.searchQuery,
        input.replacement,
        input.isRegex
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
  const fixedFields = new Set(["aliases", "tags", "status", "timeline"]);
  const normalizedField = field.trim();

  return fixedFields.has(normalizedField) || userDefinedFields.some((candidate) => candidate.name === normalizedField);
}
