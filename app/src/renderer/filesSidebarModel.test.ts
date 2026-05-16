import { describe, expect, it } from "vitest";

import {
  activeFileSearchModeLabel,
  fileSearchModeOptions,
  frontmatterValueCandidatesForField,
  isFilteringFiles,
  knownFrontmatterSearchFields
} from "./filesSidebarModel";
import { createTranslator } from "./i18n";

describe("filesSidebarModel", () => {
  it("builds known frontmatter fields from defaults and candidates", () => {
    expect(knownFrontmatterSearchFields({
      aliases: ["Alias"],
      custom: ["A"],
      status: ["Draft"]
    })).toEqual(["aliases", "author", "custom", "date", "publish", "status", "tags", "url"]);
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
      "frontmatter",
      "regex"
    ]);
    expect(activeFileSearchModeLabel(options, "frontmatter", "Full text")).toBe("Property");
    expect(activeFileSearchModeLabel(options, "fullText", "Full text")).toBe("Full text");
  });
});
