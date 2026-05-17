import { describe, expect, it } from "vitest";

import {
  isMoveItemToTrashInput,
  isMoveMarkdownFileInput,
  isReplaceInFileInput,
  isSearchWorkspaceInput,
  normalizeSearchWorkspaceInput
} from "./fileHandlerValidators";

describe("fileHandlerValidators", () => {
  it("validates workspace search input modes and optional frontmatter field", () => {
    expect(isSearchWorkspaceInput({ mode: "fullText", query: "relic" })).toBe(true);
    expect(isSearchWorkspaceInput({ frontmatterField: "status", mode: "frontmatter", query: "draft" })).toBe(true);
    expect(isSearchWorkspaceInput({ searchMode: "fullText", searchQuery: "relic" })).toBe(false);
    expect(isSearchWorkspaceInput({ mode: "unknown", query: "relic" })).toBe(false);
    expect(isSearchWorkspaceInput({ mode: "fullText", query: 1 })).toBe(false);
    expect(isSearchWorkspaceInput({ frontmatterField: 1, mode: "frontmatter", query: "draft" })).toBe(false);
  });

  it("normalizes workspace search input to the current shape", () => {
    expect(normalizeSearchWorkspaceInput({ mode: "fileName", query: "note" })).toEqual({
      frontmatterField: undefined,
      mode: "fileName",
      query: "note"
    });
    expect(normalizeSearchWorkspaceInput({
      frontmatterField: "status",
      searchMode: "frontmatter",
      searchQuery: "draft"
    })).toEqual({
      frontmatterField: "status",
      mode: "frontmatter",
      query: "draft"
    });
    expect(normalizeSearchWorkspaceInput(["ファイル", "fullText"])).toEqual({
      frontmatterField: undefined,
      mode: "fullText",
      query: "ファイル"
    });
    expect(normalizeSearchWorkspaceInput(["tag", "資料"])).toEqual({
      frontmatterField: undefined,
      mode: "tag",
      query: "資料"
    });
    expect(normalizeSearchWorkspaceInput("ファイル")).toEqual({
      mode: "fullText",
      query: "ファイル"
    });
    expect(normalizeSearchWorkspaceInput({ searchTerm: "ファイル", type: "fullText" })).toEqual({
      frontmatterField: undefined,
      mode: "fullText",
      query: "ファイル"
    });
    expect(normalizeSearchWorkspaceInput({ searchMode: "unknown", searchQuery: "draft" })).toBeNull();
  });

  it("validates move and trash inputs without accepting partial objects", () => {
    expect(isMoveMarkdownFileInput({ destinationFolder: "Archive", path: "Note.md" })).toBe(true);
    expect(isMoveMarkdownFileInput({ path: "Note.md" })).toBe(false);
    expect(isMoveItemToTrashInput({ path: "Note.md", type: "file" })).toBe(true);
    expect(isMoveItemToTrashInput({ path: "Folder", type: "folder" })).toBe(true);
    expect(isMoveItemToTrashInput({ path: "Note.md", type: "other" })).toBe(false);
  });

  it("validates replace input including regex flag", () => {
    expect(isReplaceInFileInput({
      isRegex: false,
      path: "Note.md",
      replacement: "new",
      searchQuery: "old"
    })).toBe(true);
    expect(isReplaceInFileInput({
      isRegex: "false",
      path: "Note.md",
      replacement: "new",
      searchQuery: "old"
    })).toBe(false);
  });
});
