import { describe, expect, it } from "vitest";

import {
  activeFileSearchModeLabel,
  fileSearchModeOptions,
  frontmatterValueCandidatesForField,
  isFilteringFiles,
  knownFrontmatterSearchFields
} from "./filesSidebarModel";
import { createTranslator } from "./i18nModel";

describe("filesSidebarModel", () => {
  it("builds known frontmatter fields from fixed and registered custom fields", () => {
    expect(knownFrontmatterSearchFields([
      { name: "custom", type: "text" },
      { name: "date", type: "date" }
    ])).toEqual([
      "aliases",
      "chronicle",
      "custom",
      "date",
      "tags"
    ]);
  });

  it("returns candidates only for a selected field", () => {
    const candidates = { status: ["Draft", "Done"] };

    expect(frontmatterValueCandidatesForField(candidates, "status")).toEqual(["Draft", "Done"]);
    expect(frontmatterValueCandidatesForField(candidates, "missing")).toEqual([]);
    expect(frontmatterValueCandidatesForField(candidates, "")).toEqual([]);
  });

  it("detects active filtering state", () => {
    expect(isFilteringFiles({ isSearching: false, query: "  ", searchError: null })).toBe(false);
    expect(isFilteringFiles({ isSearching: false, query: "note", searchError: null })).toBe(true);
    expect(isFilteringFiles({ isSearching: true, query: "", searchError: null })).toBe(true);
    expect(isFilteringFiles({ isSearching: false, query: "", searchError: "Bad regex" })).toBe(true);
  });

  it("labels search modes through translations", () => {
    const t = createTranslator("en");
    const options = fileSearchModeOptions(t);

    expect(options.map((option) => option.mode)).toEqual([
      "fullText",
      "fileName",
      "tag",
      "frontmatter"
    ]);
    expect(activeFileSearchModeLabel(options, "frontmatter", "Full text")).toBe("Property");
    expect(activeFileSearchModeLabel(options, "fullText", "Full text")).toBe("Full text");
  });
});
