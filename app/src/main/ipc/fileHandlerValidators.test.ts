import { describe, expect, it } from "vitest";

import {
  isMoveItemToTrashInput,
  isMoveMarkdownFileInput,
  isReplaceInFileInput,
  isSearchWorkspaceInput
} from "./fileHandlerValidators";

describe("fileHandlerValidators", () => {
  it("validates workspace search input modes and optional frontmatter field", () => {
    expect(isSearchWorkspaceInput({ mode: "fullText", query: "relic" })).toBe(true);
    expect(isSearchWorkspaceInput({ frontmatterField: "status", mode: "frontmatter", query: "draft" })).toBe(true);
    expect(isSearchWorkspaceInput({ mode: "unknown", query: "relic" })).toBe(false);
    expect(isSearchWorkspaceInput({ frontmatterField: 1, mode: "frontmatter", query: "draft" })).toBe(false);
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
