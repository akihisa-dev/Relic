import { describe, expect, it } from "vitest";

import { fail, ok } from "../shared/result";
import { createTranslator } from "./i18n";
import {
  buildMergeCardsInput,
  buildSplitCardInput,
  buildTitleListInput,
  buildTocInput,
  createDefaultMergeCardsDraft,
  createDefaultSplitCardDraft,
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
      filterCardFolder: undefined,
      outputCardFolder: ".",
      outputName: "Title List",
      sortBy: "name"
    });
    expect(buildTocInput(createDefaultTocDraft(t), t)).toEqual({
      includeSubcardFolders: true,
      outputCardFolder: ".",
      outputName: "Table of Contents",
      targetCardFolder: "."
    });
  });

  it("builds merge input with frontmatter field only for frontmatter filter", () => {
    const draft = {
      ...createDefaultMergeCardsDraft(t),
      filterType: "frontmatter" as const,
      filterValue: "draft",
      frontmatterField: "status",
      outputName: ""
    };

    expect(buildMergeCardsInput(draft, t)).toEqual({
      filterType: "frontmatter",
      filterValue: "draft",
      frontmatterField: "status",
      insertCardNameHeading: true,
      outputCardFolder: ".",
      outputName: "Merged Result",
      sortBy: "name"
    });
    expect(buildMergeCardsInput({ ...draft, filterType: "tag" }, t).frontmatterField).toBeUndefined();
  });

  it("builds split input and formats statuses", () => {
    expect(buildSplitCardInput({
      ...createDefaultSplitCardDraft(),
      sourcePath: "Book.md"
    })).toEqual({
      headingLevel: 2,
      outputCardFolder: ".",
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
