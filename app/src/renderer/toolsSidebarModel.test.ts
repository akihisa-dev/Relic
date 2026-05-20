import { describe, expect, it } from "vitest";

import { fail, ok } from "../shared/result";
import { createTranslator } from "./i18n";
import {
  buildMergeFilesInput,
  buildSplitFileInput,
  buildTitleListInput,
  buildTocInput,
  createDefaultMergeFilesDraft,
  createDefaultSplitFileDraft,
  createDefaultTitleListDraft,
  createDefaultTocDraft,
  isToolStatusError,
  resultStatus,
  splitResultStatus
} from "./toolsSidebarModel";

const t = createTranslator("en");

describe("toolsSidebarModel", () => {
  it("builds title list and toc inputs with existing fallback defaults", () => {
    expect(buildTitleListInput(createDefaultTitleListDraft(t), t)).toEqual({
      filterFolder: undefined,
      outputFolder: ".",
      outputName: "Title List",
      sortBy: "name"
    });
    expect(buildTocInput(createDefaultTocDraft(t), t)).toEqual({
      includeSubfolders: true,
      outputFolder: ".",
      outputName: "Table of Contents",
      targetFolder: "."
    });
  });

  it("builds merge input with frontmatter field only for frontmatter filter", () => {
    const draft = {
      ...createDefaultMergeFilesDraft(t),
      filterType: "frontmatter" as const,
      filterValue: "draft",
      frontmatterField: "status",
      outputName: ""
    };

    expect(buildMergeFilesInput(draft, t)).toEqual({
      filterType: "frontmatter",
      filterValue: "draft",
      frontmatterField: "status",
      insertFilenameHeading: true,
      outputFolder: ".",
      outputName: "Merged Result",
      sortBy: "name"
    });
    expect(buildMergeFilesInput({ ...draft, filterType: "tag" }, t).frontmatterField).toBeUndefined();
  });

  it("builds split input and formats statuses", () => {
    expect(buildSplitFileInput({
      ...createDefaultSplitFileDraft(),
      sourcePath: "Book.md"
    })).toEqual({
      headingLevel: 2,
      outputFolder: ".",
      sourcePath: "Book.md"
    });
    expect(resultStatus(ok("out.md"), t, String)).toBe("Done: out.md");
    expect(splitResultStatus(ok(["a.md", "b.md"]), t)).toBe("Done: 2 card(s) created");
    expect(resultStatus(fail("X", "Bad"), t, String)).toBe("Error: Bad");
    expect(isToolStatusError("Error: Bad")).toBe(true);
    expect(isToolStatusError("Done: out.md")).toBe(false);
    expect(isToolStatusError(null)).toBe(false);
  });
});
