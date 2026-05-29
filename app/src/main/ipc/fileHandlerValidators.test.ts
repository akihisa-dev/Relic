import { describe, expect, it } from "vitest";

import {
  isCreateFolderInput,
  isLinkUpdateImpactInput,
  isMoveFolderInput,
  isMoveItemToTrashInput,
  isMoveMarkdownFileInput,
  isPathInput,
  isRenameFolderInput,
  isRenameMarkdownFileInput,
  isReplaceInFileInput,
  isSearchWorkspaceInput,
  isWriteMarkdownFileInput,
  normalizeSearchWorkspaceInput
} from "./fileHandlerValidators";

describe("fileHandlerValidators", () => {
  it("validates create folder input including optional parent folder", () => {
    expect(isCreateFolderInput({ name: "Archive" })).toBe(true);
    expect(isCreateFolderInput({ name: "Archive", parentFolder: "Notes" })).toBe(true);
    expect(isCreateFolderInput({ name: "Archive", parentFolder: "" })).toBe(true);
    expect(isCreateFolderInput({ name: "Archive", parentFolder: undefined })).toBe(true);
    expect(isCreateFolderInput({ name: "Archive", parentFolder: 1 })).toBe(false);
    expect(isCreateFolderInput({ name: "Archive", parentFolder: "../outside" })).toBe(false);
    expect(isCreateFolderInput({ name: "Archive", parentFolder: " Notes " })).toBe(false);
    expect(isCreateFolderInput({ parentFolder: "Notes" })).toBe(false);
  });

  it("validates link update impact input paths", () => {
    expect(isLinkUpdateImpactInput({ kind: "file", newPath: "Archive/Note.md", oldPath: "Note.md" })).toBe(true);
    expect(isLinkUpdateImpactInput({ kind: "folder", newPath: "Archive/Notes", oldPath: "Notes" })).toBe(true);
    expect(isLinkUpdateImpactInput({ kind: "file", newPath: "../outside.md", oldPath: "Note.md" })).toBe(false);
    expect(isLinkUpdateImpactInput({ kind: "file", newPath: "/tmp/outside.md", oldPath: "Note.md" })).toBe(false);
    expect(isLinkUpdateImpactInput({ kind: "file", newPath: "Archive/Note.md", oldPath: " Note.md " })).toBe(false);
    expect(isLinkUpdateImpactInput({ kind: "other", newPath: "Archive/Note.md", oldPath: "Note.md" })).toBe(false);
  });

  it("validates path input as a normalized workspace-relative path", () => {
    expect(isPathInput({ path: "Notes/Idea.md" })).toBe(true);
    expect(isPathInput({ path: "../outside.md" })).toBe(false);
    expect(isPathInput({ path: "/tmp/outside.md" })).toBe(false);
    expect(isPathInput({ path: "Notes\\Idea.md" })).toBe(false);
    expect(isPathInput({ path: " Notes/Idea.md " })).toBe(false);
  });

  it("validates workspace search input modes and optional frontmatter field", () => {
    expect(isSearchWorkspaceInput({ mode: "fullText", query: "relic" })).toBe(true);
    expect(isSearchWorkspaceInput({ frontmatterField: undefined, mode: "fullText", query: "relic" })).toBe(true);
    expect(isSearchWorkspaceInput({ frontmatterField: "status", mode: "frontmatter", query: "draft" })).toBe(true);
    expect(isSearchWorkspaceInput({ searchMode: "fullText", searchQuery: "relic" })).toBe(false);
    expect(isSearchWorkspaceInput({ mode: "unknown", query: "relic" })).toBe(false);
    expect(isSearchWorkspaceInput({ mode: "fullText", query: 1 })).toBe(false);
    expect(isSearchWorkspaceInput({ frontmatterField: 1, mode: "frontmatter", query: "draft" })).toBe(false);
  });

  it("normalizes workspace search input to the current shape", () => {
    expect(normalizeSearchWorkspaceInput({ mode: "fileName", query: "note" })).toEqual({
      mode: "fileName",
      query: "note"
    });
    expect(normalizeSearchWorkspaceInput({
      frontmatterField: undefined,
      mode: "fullText",
      query: "ファイル"
    })).toEqual({
      mode: "fullText",
      query: "ファイル"
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
    expect(normalizeSearchWorkspaceInput(["ファイル", "全文"])).toEqual({
      frontmatterField: undefined,
      mode: "fullText",
      query: "ファイル"
    });
    expect(normalizeSearchWorkspaceInput({ mode: "全文", query: "ファイル" })).toEqual({
      mode: "fullText",
      query: "ファイル"
    });
    expect(normalizeSearchWorkspaceInput(["tag", "資料"])).toEqual({
      frontmatterField: undefined,
      mode: "tag",
      query: "資料"
    });
    expect(normalizeSearchWorkspaceInput(["タグ", "資料"])).toEqual({
      frontmatterField: undefined,
      mode: "tag",
      query: "資料"
    });
    expect(normalizeSearchWorkspaceInput("ファイル")).toEqual({
      mode: "fullText",
      query: "ファイル"
    });
    expect(normalizeSearchWorkspaceInput({ searchTerm: "ファイル", type: "fullText" })).toEqual({
      mode: "fullText",
      query: "ファイル"
    });
    expect(normalizeSearchWorkspaceInput({ searchMode: "unknown", searchQuery: "draft" })).toBeNull();
  });

  it("validates move and trash inputs without accepting partial objects", () => {
    expect(isMoveMarkdownFileInput({ destinationFolder: "Archive", path: "Note.md" })).toBe(true);
    expect(isMoveMarkdownFileInput({ destinationFolder: "", path: "Note.md" })).toBe(true);
    expect(isMoveMarkdownFileInput({ path: "Note.md" })).toBe(false);
    expect(isMoveMarkdownFileInput({ destinationFolder: "../outside", path: "Note.md" })).toBe(false);
    expect(isMoveMarkdownFileInput({ destinationFolder: "Archive", path: "../outside.md" })).toBe(false);
    expect(isMoveFolderInput({ destinationFolder: "Archive", path: "Notes" })).toBe(true);
    expect(isMoveFolderInput({ destinationFolder: "", path: "Notes" })).toBe(true);
    expect(isMoveFolderInput({ destinationFolder: "../outside", path: "Notes" })).toBe(false);
    expect(isMoveFolderInput({ destinationFolder: "Archive", path: " Notes " })).toBe(false);
    expect(isMoveItemToTrashInput({ path: "Note.md", type: "file" })).toBe(true);
    expect(isMoveItemToTrashInput({ path: "Folder", type: "folder" })).toBe(true);
    expect(isMoveItemToTrashInput({ path: "../outside.md", type: "file" })).toBe(false);
    expect(isMoveItemToTrashInput({ path: "Note.md", type: "other" })).toBe(false);
  });

  it("validates rename inputs with normalized workspace-relative paths", () => {
    expect(isRenameMarkdownFileInput({ newName: "New", path: "Note.md" })).toBe(true);
    expect(isRenameMarkdownFileInput({ newName: "New", path: "../outside.md" })).toBe(false);
    expect(isRenameFolderInput({ newName: "Archive", path: "Notes" })).toBe(true);
    expect(isRenameFolderInput({ newName: "Archive", path: " Notes " })).toBe(false);
  });

  it("validates replace input including regex flag", () => {
    expect(isReplaceInFileInput({
      isRegex: false,
      path: "Note.md",
      replacement: "new",
      searchQuery: "old"
    })).toBe(true);
    expect(isReplaceInFileInput({
      isRegex: false,
      path: "../outside.md",
      replacement: "new",
      searchQuery: "old"
    })).toBe(false);
    expect(isReplaceInFileInput({
      isRegex: "false",
      path: "Note.md",
      replacement: "new",
      searchQuery: "old"
    })).toBe(false);
  });

  it("validates write input as content plus a normalized workspace-relative path", () => {
    expect(isWriteMarkdownFileInput({ content: "# Note", path: "Note.md" })).toBe(true);
    expect(isWriteMarkdownFileInput({ content: "# Note", path: "Notes/Idea.md" })).toBe(true);
    expect(isWriteMarkdownFileInput({ content: "# Note", path: "../outside.md" })).toBe(false);
    expect(isWriteMarkdownFileInput({ content: "# Note", path: "/tmp/outside.md" })).toBe(false);
    expect(isWriteMarkdownFileInput({ content: "# Note", path: " Notes/Idea.md " })).toBe(false);
    expect(isWriteMarkdownFileInput({ content: 1, path: "Note.md" })).toBe(false);
  });
});
