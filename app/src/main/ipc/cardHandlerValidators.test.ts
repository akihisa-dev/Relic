import { describe, expect, it } from "vitest";

import {
  isMoveItemToTrashInput,
  isMoveMarkdownCardInput,
  isReplaceInCardInput,
  isSearchCardbookInput,
  normalizeSearchCardbookInput
} from "./cardHandlerValidators";

describe("cardHandlerValidators", () => {
  it("validates cardbook search input modes and optional frontmatter field", () => {
    expect(isSearchCardbookInput({ mode: "fullText", query: "relic" })).toBe(true);
    expect(isSearchCardbookInput({ frontmatterField: undefined, mode: "fullText", query: "relic" })).toBe(true);
    expect(isSearchCardbookInput({ frontmatterField: "status", mode: "frontmatter", query: "draft" })).toBe(true);
    expect(isSearchCardbookInput({ searchMode: "fullText", searchQuery: "relic" })).toBe(false);
    expect(isSearchCardbookInput({ mode: "unknown", query: "relic" })).toBe(false);
    expect(isSearchCardbookInput({ mode: "fullText", query: 1 })).toBe(false);
    expect(isSearchCardbookInput({ frontmatterField: 1, mode: "frontmatter", query: "draft" })).toBe(false);
  });

  it("normalizes cardbook search input to the current shape", () => {
    expect(normalizeSearchCardbookInput({ mode: "cardName", query: "note" })).toEqual({
      mode: "cardName",
      query: "note"
    });
    expect(normalizeSearchCardbookInput({
      frontmatterField: undefined,
      mode: "fullText",
      query: "カード"
    })).toEqual({
      mode: "fullText",
      query: "カード"
    });
    expect(normalizeSearchCardbookInput({
      frontmatterField: "status",
      searchMode: "frontmatter",
      searchQuery: "draft"
    })).toEqual({
      frontmatterField: "status",
      mode: "frontmatter",
      query: "draft"
    });
    expect(normalizeSearchCardbookInput(["カード", "fullText"])).toEqual({
      frontmatterField: undefined,
      mode: "fullText",
      query: "カード"
    });
    expect(normalizeSearchCardbookInput(["カード", "全文"])).toEqual({
      frontmatterField: undefined,
      mode: "fullText",
      query: "カード"
    });
    expect(normalizeSearchCardbookInput({ mode: "全文", query: "カード" })).toEqual({
      mode: "fullText",
      query: "カード"
    });
    expect(normalizeSearchCardbookInput(["tag", "資料"])).toEqual({
      frontmatterField: undefined,
      mode: "tag",
      query: "資料"
    });
    expect(normalizeSearchCardbookInput(["タグ", "資料"])).toEqual({
      frontmatterField: undefined,
      mode: "tag",
      query: "資料"
    });
    expect(normalizeSearchCardbookInput("カード")).toEqual({
      mode: "fullText",
      query: "カード"
    });
    expect(normalizeSearchCardbookInput({ searchTerm: "カード", type: "fullText" })).toEqual({
      mode: "fullText",
      query: "カード"
    });
    expect(normalizeSearchCardbookInput({ searchMode: "unknown", searchQuery: "draft" })).toBeNull();
  });

  it("validates move and trash inputs without accepting partial objects", () => {
    expect(isMoveMarkdownCardInput({ destinationCardFolder: "Archive", path: "Note.md" })).toBe(true);
    expect(isMoveMarkdownCardInput({ path: "Note.md" })).toBe(false);
    expect(isMoveItemToTrashInput({ path: "Note.md", type: "card" })).toBe(true);
    expect(isMoveItemToTrashInput({ path: "CardFolder", type: "cardFolder" })).toBe(true);
    expect(isMoveItemToTrashInput({ path: "Note.md", type: "other" })).toBe(false);
  });

  it("validates replace input including regex flag", () => {
    expect(isReplaceInCardInput({
      isRegex: false,
      path: "Note.md",
      replacement: "new",
      searchQuery: "old"
    })).toBe(true);
    expect(isReplaceInCardInput({
      isRegex: "false",
      path: "Note.md",
      replacement: "new",
      searchQuery: "old"
    })).toBe(false);
  });
});
