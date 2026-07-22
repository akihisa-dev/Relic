import { describe, expect, it } from "vitest";

import { maxToolTargetFiles } from "../../shared/ipc";
import {
  isGenerateTagIndexInput,
  isGenerateTableOfContentsInput,
  isGenerateTitleListInput,
  isMergeFilesInput
} from "./toolHandlerValidators";

describe("toolHandlerValidators", () => {
  it("validates title list and table of contents inputs", () => {
    expect(isGenerateTitleListInput({
      filterFolder: "Notes",
      outputFolder: "",
      outputName: "Titles",
      sortBy: "mtime",
      target: { kind: "workspace" }
    })).toBe(true);
    expect(isGenerateTitleListInput({
      outputFolder: "",
      outputName: "Titles",
      sortBy: "ctime",
      target: { kind: "workspace" }
    })).toBe(false);
    expect(isGenerateTitleListInput({
      filterFolder: " Notes ",
      outputFolder: "",
      outputName: "Titles",
      sortBy: "name",
      target: { kind: "workspace" }
    })).toBe(false);
    expect(isGenerateTitleListInput({
      outputFolder: "../outside",
      outputName: "Titles",
      sortBy: "name",
      target: { kind: "workspace" }
    })).toBe(false);
    expect(isGenerateTableOfContentsInput({
      outputFolder: "",
      outputName: "Toc",
      target: { kind: "folder", path: "Notes" }
    })).toBe(true);
    expect(isGenerateTableOfContentsInput({
      outputFolder: "",
      outputName: "Toc"
    })).toBe(false);
    expect(isGenerateTableOfContentsInput({
      outputFolder: "",
      outputName: "Toc",
      target: { kind: "folder", path: "../Notes" }
    })).toBe(false);
  });

  it("validates tag index inputs", () => {
    expect(isGenerateTagIndexInput({
      includeUntagged: false,
      outputFolder: "",
      outputName: "Tags",
      sortBy: "name",
      target: { kind: "folder", path: "Notes" }
    })).toBe(true);
    expect(isGenerateTagIndexInput({
      includeUntagged: false,
      outputFolder: "",
      outputName: "Tags",
      sortBy: "ctime",
      target: { kind: "folder", path: "Notes" }
    })).toBe(false);
    expect(isGenerateTagIndexInput({
      includeUntagged: false,
      outputFolder: "../outside",
      outputName: "Tags",
      sortBy: "name",
      target: { kind: "folder", path: "Notes" }
    })).toBe(false);
    expect(isGenerateTagIndexInput({
      includeUntagged: "false",
      outputFolder: "",
      outputName: "Tags",
      sortBy: "name",
      target: { kind: "folder", path: "Notes" }
    })).toBe(false);
  });

  it("validates merge inputs", () => {
    expect(isMergeFilesInput({
      filterType: "frontmatter",
      filterValue: "draft",
      frontmatterField: "status",
      insertFilenameHeading: true,
      outputFolder: "",
      outputName: "Merged",
      sortBy: "ctime",
      target: { kind: "workspace" }
    })).toBe(true);
    expect(isMergeFilesInput({
      filterType: "all",
      filterValue: "",
      insertFilenameHeading: true,
      outputFolder: "",
      outputName: "Merged",
      sortBy: "created",
      target: { kind: "workspace" }
    })).toBe(false);
    expect(isMergeFilesInput({
      filterType: "folder",
      filterValue: "../outside",
      insertFilenameHeading: true,
      outputFolder: "",
      outputName: "Merged",
      sortBy: "name",
      target: { kind: "workspace" }
    })).toBe(false);
  });

  it("validates explicit tool targets before processing", () => {
    const base = {
      outputFolder: "",
      outputName: "Titles",
      sortBy: "name" as const
    };
    expect(isGenerateTitleListInput({
      ...base,
      target: { kind: "files", paths: ["a.md", "folder/b.md"] }
    })).toBe(true);
    expect(isGenerateTitleListInput({
      ...base,
      target: { kind: "files", paths: ["a.md", "a.md"] }
    })).toBe(false);
    expect(isGenerateTitleListInput({
      ...base,
      target: { kind: "files", paths: ["../a.md", "b.md"] }
    })).toBe(false);
    expect(isGenerateTitleListInput({
      ...base,
      target: { kind: "folder", path: "/outside" }
    })).toBe(false);
    expect(isGenerateTitleListInput({
      ...base,
      target: { kind: "files", paths: ["a.md"] }
    })).toBe(false);
    expect(isGenerateTitleListInput({
      ...base,
      target: { kind: "files", paths: ["a.md", "image.png"] }
    })).toBe(false);
    expect(isGenerateTitleListInput({
      ...base,
      target: { kind: "files", paths: ["a.md", "nul\0.md"] }
    })).toBe(false);
    expect(isGenerateTitleListInput({
      ...base,
      target: {
        kind: "files",
        paths: Array.from({ length: maxToolTargetFiles + 1 }, (_, index) => `note-${index}.md`)
      }
    })).toBe(false);
    expect(isGenerateTitleListInput({ ...base, target: { kind: "workspace" } })).toBe(true);
  });
});
