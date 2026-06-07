import { describe, expect, it } from "vitest";

import { fail, ok } from "../shared/result";
import { createTranslator } from "./i18nModel";
import {
  buildMergeFilesInput,
  buildTagIndexInput,
  buildTitleListInput,
  buildTocInput,
  createDefaultMergeFilesDraft,
  createDefaultTagIndexDraft,
  createDefaultTitleListDraft,
  createDefaultTocDraft,
  isToolStatusError,
  resultStatus
} from "./toolsPanelModel";

const t = createTranslator("en");

describe("toolsPanelModel", () => {
  it("builds title list and toc inputs with existing fallback defaults", () => {
    expect(buildTitleListInput(createDefaultTitleListDraft(t), t)).toEqual({
      filterFolder: undefined,
      outputFolder: "",
      outputName: "Title List",
      sortBy: "name"
    });
    expect(buildTocInput(createDefaultTocDraft(t), t)).toEqual({
      includeSubfolders: true,
      outputFolder: "",
      outputName: "Table of Contents",
      targetFolder: ""
    });
  });

  it("builds tag index input with fallback defaults", () => {
    const draft = {
      ...createDefaultTagIndexDraft(t),
      includeUntagged: true,
      outputName: "",
      sortBy: "mtime" as const,
      targetFolder: "Notes"
    };

    expect(buildTagIndexInput(draft, t)).toEqual({
      includeSubfolders: true,
      includeUntagged: true,
      outputFolder: "",
      outputName: "Tag Index",
      sortBy: "mtime",
      targetFolder: "Notes"
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
      outputFolder: "",
      outputName: "Merged Result",
      sortBy: "name"
    });
    expect(buildMergeFilesInput({ ...draft, filterType: "tag" }, t).frontmatterField).toBeUndefined();
  });

  it("formats tool statuses", () => {
    expect(resultStatus(ok("out.md"), t, String)).toBe("Done: out.md");
    expect(resultStatus(fail("X", "Bad"), t, String)).toBe("Error: Bad");
    expect(isToolStatusError("Error: Bad")).toBe(true);
    expect(isToolStatusError("Done: out.md")).toBe(false);
    expect(isToolStatusError(null)).toBe(false);
  });
});
