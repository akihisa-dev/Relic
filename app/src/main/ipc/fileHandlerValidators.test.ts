import { describe, expect, it } from "vitest";

import {
  maxExpectedFileSnapshots,
  maxImportMarkdownFiles,
  maxMarkdownWriteBytes,
  maxReplacementBytes,
  maxSearchQueryLength,
  maxWorkspaceRelativePathLength,
  type SearchAndReplaceInput
} from "../../shared/ipc";
import {
  isCreateFolderInput,
  isCreateMarkdownFileInput,
  isImportMarkdownFilesInput,
  isLinkUpdateImpactInput,
  isMoveFolderInput,
  isMoveItemToTrashInput,
  isMoveMarkdownFileInput,
  isPathInput,
  isRevealWorkspaceItemInput,
  isRenameFolderInput,
  isRenameMarkdownFileInput,
  isReplaceInFileInput,
  isSearchAndReplaceInput,
  isSearchWorkspaceInput,
  isStartWorkspaceFileDragInput,
  isWriteMarkdownFileInput,
  normalizeSearchWorkspaceInput
} from "./fileHandlerValidators";

describe("fileHandlerValidators", () => {
  it("preload公開ファイル操作APIの入力をメイン側で検証できる", () => {
    const validators = [
      { accepts: { name: "Note" }, rejects: { name: 1 }, validator: isCreateMarkdownFileInput },
      {
        accepts: { destinationFolder: "", sourcePaths: ["/tmp/Note.md"] },
        rejects: { destinationFolder: "../outside", sourcePaths: ["/tmp/Note.md"] },
        validator: isImportMarkdownFilesInput
      },
      { accepts: { path: "Folder/Note.md" }, rejects: { path: "/tmp/outside.md" }, validator: isPathInput },
      {
        accepts: { paths: ["Folder/Note.md", "Root.md"] },
        rejects: { paths: ["/tmp/outside.md"] },
        validator: isStartWorkspaceFileDragInput
      },
      {
        accepts: { kind: "file", newPath: "Archive/Note.md", oldPath: "Note.md" },
        rejects: { kind: "file", newPath: "Archive/Note.md", oldPath: "../Note.md" },
        validator: isLinkUpdateImpactInput
      },
      { accepts: { newName: "New", path: "Note.md" }, rejects: { newName: "New", path: "C:\\outside.md" }, validator: isRenameMarkdownFileInput },
      { accepts: { destinationFolder: "", path: "Note.md" }, rejects: { destinationFolder: "/tmp", path: "Note.md" }, validator: isMoveMarkdownFileInput },
      { accepts: { path: "", workspaceId: "ws-1" }, rejects: { path: "../outside", workspaceId: "ws-1" }, validator: isRevealWorkspaceItemInput },
      {
        accepts: { content: "# Note", expectedContent: "old", path: "Note.md" },
        rejects: { content: "# Note", path: "note.md\0outside" },
        validator: isWriteMarkdownFileInput
      },
      {
        accepts: { isRegex: false, path: "Note.md", replacement: "new", searchQuery: "old" },
        rejects: { isRegex: false, path: "\\\\server\\share\\note.md", replacement: "new", searchQuery: "old" },
        validator: isReplaceInFileInput
      },
      {
        accepts: { expectedFileSnapshots: [{ contentHash: "hash", path: "Note.md" }], isRegex: false, replacement: "new", searchQuery: "old" },
        rejects: { expectedFileSnapshots: [{ contentHash: 1, path: "Note.md" }], isRegex: false, replacement: "new", searchQuery: "old" },
        validator: isSearchAndReplaceInput
      },
      { accepts: { name: "Archive", parentFolder: "" }, rejects: { name: "Archive", parentFolder: "../outside" }, validator: isCreateFolderInput },
      { accepts: { newName: "Archive", path: "Notes" }, rejects: { newName: "Archive", path: "/tmp/Notes" }, validator: isRenameFolderInput },
      { accepts: { destinationFolder: "", path: "Notes" }, rejects: { destinationFolder: "Archive", path: " Notes " }, validator: isMoveFolderInput },
      { accepts: { path: "Note.md", type: "file" }, rejects: { path: "../Note.md", type: "file" }, validator: isMoveItemToTrashInput }
    ];

    for (const { accepts, rejects, validator } of validators) {
      expect(validator(accepts)).toBe(true);
      expect(validator(rejects)).toBe(false);
    }
  });

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

  it("validates import markdown files input", () => {
    expect(isImportMarkdownFilesInput({ destinationFolder: "", sourcePaths: ["/tmp/Note.md"] })).toBe(true);
    expect(isImportMarkdownFilesInput({ destinationFolder: "Archive", sourcePaths: ["C:\\Users\\me\\Note.md"] })).toBe(true);
    expect(isImportMarkdownFilesInput({ destinationFolder: "../outside", sourcePaths: ["/tmp/Note.md"] })).toBe(false);
    expect(isImportMarkdownFilesInput({ destinationFolder: "", sourcePaths: [] })).toBe(false);
    expect(isImportMarkdownFilesInput({ destinationFolder: "", sourcePaths: [" /tmp/Note.md "] })).toBe(false);
    expect(isImportMarkdownFilesInput({ destinationFolder: "", sourcePaths: ["/tmp/Note.md\0"] })).toBe(false);
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
    expect(isPathInput({ path: `${"a".repeat(maxWorkspaceRelativePathLength - 3)}.md` })).toBe(true);
    expect(isPathInput({ path: "../outside.md" })).toBe(false);
    expect(isPathInput({ path: "/tmp/outside.md" })).toBe(false);
    expect(isPathInput({ path: "Notes\\Idea.md" })).toBe(false);
    expect(isPathInput({ path: " Notes/Idea.md " })).toBe(false);
    expect(isPathInput({ path: `${"a".repeat(maxWorkspaceRelativePathLength - 2)}.md` })).toBe(false);
  });

  it("validates reveal workspace item input with workspace id and root path", () => {
    expect(isRevealWorkspaceItemInput({ path: "", workspaceId: "ws-1" })).toBe(true);
    expect(isRevealWorkspaceItemInput({ path: "", workspaceId: "ws_1" })).toBe(true);
    expect(isRevealWorkspaceItemInput({ path: "Archive/Note.md" })).toBe(true);
    expect(isRevealWorkspaceItemInput({ path: "", workspaceId: "space space" })).toBe(false);
    expect(isRevealWorkspaceItemInput({ path: "../outside.md", workspaceId: "ws-1" })).toBe(false);
    expect(isRevealWorkspaceItemInput({ path: "Archive/Note.md", workspaceId: "../outside" })).toBe(false);
    expect(isRevealWorkspaceItemInput({ workspaceId: "ws-1" })).toBe(false);
  });

  it("validates workspace search input modes and optional frontmatter field", () => {
    expect(isSearchWorkspaceInput({ mode: "fullText", query: "relic" })).toBe(true);
    expect(isSearchWorkspaceInput({ frontmatterField: undefined, mode: "fullText", query: "relic" })).toBe(true);
    expect(isSearchWorkspaceInput({ frontmatterField: "status", mode: "frontmatter", query: "draft" })).toBe(true);
    expect(isSearchWorkspaceInput({ searchMode: "fullText", searchQuery: "relic" })).toBe(false);
    expect(isSearchWorkspaceInput({ mode: "unknown", query: "relic" })).toBe(false);
    expect(isSearchWorkspaceInput({ mode: "regex", query: "relic" })).toBe(false);
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
    expect(normalizeSearchWorkspaceInput(["regex", "^# "])).toBeNull();
    expect(normalizeSearchWorkspaceInput({ searchMode: "正規表現", searchQuery: "^# " })).toBeNull();
    expect(normalizeSearchWorkspaceInput("ファイル")).toEqual({
      mode: "fullText",
      query: "ファイル"
    });
    expect(normalizeSearchWorkspaceInput({ searchTerm: "ファイル", type: "fullText" })).toEqual({
      mode: "fullText",
      query: "ファイル"
    });
    expect(normalizeSearchWorkspaceInput({ searchMode: "unknown", searchQuery: "draft" })).toBeNull();
    expect(normalizeSearchWorkspaceInput("x".repeat(maxSearchQueryLength + 1))).toBeNull();
    expect(normalizeSearchWorkspaceInput(["x".repeat(maxSearchQueryLength + 1), "fullText"])).toBeNull();
    expect(normalizeSearchWorkspaceInput(["frontmatter", "draft", "x".repeat(maxSearchQueryLength + 1)])).toBeNull();
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
    expect(isWriteMarkdownFileInput({ content: "# Note", expectedContent: "old", path: "Note.md" })).toBe(true);
    expect(isWriteMarkdownFileInput({ content: "# Note", path: "Notes/Idea.md" })).toBe(true);
    expect(isWriteMarkdownFileInput({ content: "# Note", path: "../outside.md" })).toBe(false);
    expect(isWriteMarkdownFileInput({ content: "# Note", path: "/tmp/outside.md" })).toBe(false);
    expect(isWriteMarkdownFileInput({ content: "# Note", path: " Notes/Idea.md " })).toBe(false);
    expect(isWriteMarkdownFileInput({ content: 1, path: "Note.md" })).toBe(false);
    expect(isWriteMarkdownFileInput({ content: "# Note", expectedContent: 1, path: "Note.md" })).toBe(false);
  });

  it("rejects oversized IPC inputs before file operations can use them", () => {
    expect(isImportMarkdownFilesInput({
      destinationFolder: "",
      sourcePaths: Array.from({ length: maxImportMarkdownFiles + 1 }, (_value, index) => `/tmp/${index}.md`)
    })).toBe(false);
    expect(isWriteMarkdownFileInput({
      content: "x".repeat(maxMarkdownWriteBytes + 1),
      path: "Note.md"
    })).toBe(false);
    expect(isWriteMarkdownFileInput({
      content: "# Note",
      expectedContent: "x".repeat(maxMarkdownWriteBytes + 1),
      path: "Note.md"
    })).toBe(false);
    expect(isSearchWorkspaceInput({
      mode: "fullText",
      query: "x".repeat(maxSearchQueryLength + 1)
    })).toBe(false);
    expect(isSearchWorkspaceInput({
      frontmatterField: "x".repeat(maxSearchQueryLength + 1),
      mode: "frontmatter",
      query: "draft"
    })).toBe(false);
    expect(isReplaceInFileInput({
      isRegex: false,
      path: "Note.md",
      replacement: "new",
      searchQuery: "x".repeat(maxSearchQueryLength + 1)
    })).toBe(false);
    expect(isReplaceInFileInput({
      isRegex: false,
      path: "Note.md",
      replacement: "x".repeat(maxReplacementBytes + 1),
      searchQuery: "old"
    })).toBe(false);

    const tooManySnapshots: SearchAndReplaceInput["expectedFileSnapshots"] = Array.from(
      { length: maxExpectedFileSnapshots + 1 },
      (_value, index) => ({ contentHash: `hash-${index}`, path: `Note-${index}.md` })
    );
    expect(isSearchAndReplaceInput({
      expectedFileSnapshots: tooManySnapshots,
      isRegex: false,
      replacement: "new",
      searchQuery: "old"
    })).toBe(false);
  });
});
