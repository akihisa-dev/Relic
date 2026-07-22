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
    expect(buildTitleListInput(createDefaultTitleListDraft(t), t, { kind: "workspace" })).toEqual({
      filterFolder: undefined,
      outputFolder: "",
      outputName: "Title List",
      sortBy: "name",
      target: { kind: "workspace" }
    });
    expect(buildTocInput(createDefaultTocDraft(t), t, { kind: "folder", path: "Notes" })).toEqual({
      outputFolder: "",
      outputName: "Table of Contents",
      target: { kind: "folder", path: "Notes" }
    });
  });

  it("builds tag index input with fallback defaults", () => {
    const draft = {
      ...createDefaultTagIndexDraft(t),
      includeUntagged: true,
      outputName: "",
      sortBy: "mtime" as const
    };

    expect(buildTagIndexInput(draft, t, { kind: "folder", path: "Notes" })).toEqual({
      includeUntagged: true,
      outputFolder: "",
      outputName: "Tag Index",
      sortBy: "mtime",
      target: { kind: "folder", path: "Notes" }
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

    expect(buildMergeFilesInput(draft, t, { kind: "workspace" })).toEqual({
      filterType: "frontmatter",
      filterValue: "draft",
      frontmatterField: "status",
      insertFilenameHeading: true,
      outputFolder: "",
      outputName: "Merged Result",
      sortBy: "name",
      target: { kind: "workspace" }
    });
    expect(buildMergeFilesInput({ ...draft, filterType: "tag" }, t, { kind: "workspace" }).frontmatterField).toBeUndefined();
  });

  it("formats tool statuses", () => {
    expect(resultStatus(ok("out.md"), t, String)).toBe("Done: out.md");
    expect(resultStatus(fail("X", "Bad"), t, String)).toBe("Error: Bad");
    expect(isToolStatusError("Error: Bad")).toBe(true);
    expect(isToolStatusError("Done: out.md")).toBe(false);
    expect(isToolStatusError(null)).toBe(false);
  });
});
