import { describe, expect, it } from "vitest";

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
      sortBy: "mtime"
    })).toBe(true);
    expect(isGenerateTitleListInput({
      outputFolder: "",
      outputName: "Titles",
      sortBy: "ctime"
    })).toBe(false);
    expect(isGenerateTitleListInput({
      filterFolder: " Notes ",
      outputFolder: "",
      outputName: "Titles",
      sortBy: "name"
    })).toBe(false);
    expect(isGenerateTitleListInput({
      outputFolder: "../outside",
      outputName: "Titles",
      sortBy: "name"
    })).toBe(false);
    expect(isGenerateTableOfContentsInput({
      includeSubfolders: true,
      outputFolder: "",
      outputName: "Toc",
      targetFolder: "Notes"
    })).toBe(true);
    expect(isGenerateTableOfContentsInput({
      includeSubfolders: true,
      outputFolder: "",
      outputName: "Toc",
      targetFolder: ""
    })).toBe(true);
    expect(isGenerateTableOfContentsInput({
      includeSubfolders: true,
      outputFolder: "",
      outputName: "Toc",
      targetFolder: "."
    })).toBe(false);
    expect(isGenerateTableOfContentsInput({
      includeSubfolders: "true",
      outputFolder: "",
      outputName: "Toc",
      targetFolder: "Notes"
    })).toBe(false);
  });

  it("validates tag index inputs", () => {
    expect(isGenerateTagIndexInput({
      includeSubfolders: true,
      includeUntagged: false,
      outputFolder: "",
      outputName: "Tags",
      sortBy: "name",
      targetFolder: "Notes"
    })).toBe(true);
    expect(isGenerateTagIndexInput({
      includeSubfolders: true,
      includeUntagged: false,
      outputFolder: "",
      outputName: "Tags",
      sortBy: "ctime",
      targetFolder: "Notes"
    })).toBe(false);
    expect(isGenerateTagIndexInput({
      includeSubfolders: true,
      includeUntagged: false,
      outputFolder: "../outside",
      outputName: "Tags",
      sortBy: "name",
      targetFolder: "Notes"
    })).toBe(false);
    expect(isGenerateTagIndexInput({
      includeSubfolders: true,
      includeUntagged: "false",
      outputFolder: "",
      outputName: "Tags",
      sortBy: "name",
      targetFolder: "Notes"
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
      sortBy: "ctime"
    })).toBe(true);
    expect(isMergeFilesInput({
      filterType: "all",
      filterValue: "",
      insertFilenameHeading: true,
      outputFolder: "",
      outputName: "Merged",
      sortBy: "created"
    })).toBe(false);
    expect(isMergeFilesInput({
      filterType: "folder",
      filterValue: "../outside",
      insertFilenameHeading: true,
      outputFolder: "",
      outputName: "Merged",
      sortBy: "name"
    })).toBe(false);
  });
});
