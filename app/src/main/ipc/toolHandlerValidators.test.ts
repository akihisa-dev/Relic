import { describe, expect, it } from "vitest";

import {
  isGenerateTableOfContentsInput,
  isGenerateTitleListInput,
  isMergeFilesInput,
  isSplitFileByHeadingInput
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
    expect(isGenerateTableOfContentsInput({
      includeSubfolders: true,
      outputFolder: "",
      outputName: "Toc",
      targetFolder: "Notes"
    })).toBe(true);
    expect(isGenerateTableOfContentsInput({
      includeSubfolders: "true",
      outputFolder: "",
      outputName: "Toc",
      targetFolder: "Notes"
    })).toBe(false);
  });

  it("validates merge and split inputs", () => {
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
    expect(isSplitFileByHeadingInput({
      headingLevel: 2,
      outputFolder: "Split",
      sourcePath: "Source.md"
    })).toBe(true);
    expect(isSplitFileByHeadingInput({
      headingLevel: 4,
      outputFolder: "Split",
      sourcePath: "Source.md"
    })).toBe(false);
  });
});
