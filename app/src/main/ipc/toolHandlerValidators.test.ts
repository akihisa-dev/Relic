import { describe, expect, it } from "vitest";

import {
  isGenerateTableOfContentsInput,
  isGenerateTitleListInput,
  isMergeCardsInput,
  isSplitCardByHeadingInput
} from "./toolHandlerValidators";

describe("toolHandlerValidators", () => {
  it("validates title list and table of contents inputs", () => {
    expect(isGenerateTitleListInput({
      filterCardFolder: "Notes",
      outputCardFolder: "",
      outputName: "Titles",
      sortBy: "mtime"
    })).toBe(true);
    expect(isGenerateTitleListInput({
      outputCardFolder: "",
      outputName: "Titles",
      sortBy: "ctime"
    })).toBe(false);
    expect(isGenerateTableOfContentsInput({
      includeSubcardFolders: true,
      outputCardFolder: "",
      outputName: "Toc",
      targetCardFolder: "Notes"
    })).toBe(true);
    expect(isGenerateTableOfContentsInput({
      includeSubcardFolders: "true",
      outputCardFolder: "",
      outputName: "Toc",
      targetCardFolder: "Notes"
    })).toBe(false);
  });

  it("validates merge and split inputs", () => {
    expect(isMergeCardsInput({
      filterType: "frontmatter",
      filterValue: "draft",
      frontmatterField: "status",
      insertCardNameHeading: true,
      outputCardFolder: "",
      outputName: "Merged",
      sortBy: "ctime"
    })).toBe(true);
    expect(isMergeCardsInput({
      filterType: "all",
      filterValue: "",
      insertCardNameHeading: true,
      outputCardFolder: "",
      outputName: "Merged",
      sortBy: "created"
    })).toBe(false);
    expect(isSplitCardByHeadingInput({
      headingLevel: 2,
      outputCardFolder: "Split",
      sourcePath: "Source.md"
    })).toBe(true);
    expect(isSplitCardByHeadingInput({
      headingLevel: 4,
      outputCardFolder: "Split",
      sourcePath: "Source.md"
    })).toBe(false);
  });
});
