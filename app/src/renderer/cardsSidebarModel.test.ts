import { describe, expect, it } from "vitest";

import {
  activeCardSearchModeLabel,
  cardSearchModeOptions,
  frontmatterValueCandidatesForField,
  isFilteringCards,
  knownFrontmatterSearchFields
} from "./cardsSidebarModel";
import { createTranslator } from "./i18n";

describe("cardsSidebarModel", () => {
  it("builds known frontmatter fields from fixed and registered custom fields", () => {
    expect(knownFrontmatterSearchFields([
      { name: "custom", type: "text" },
      { name: "date", type: "date" }
    ])).toEqual(["aliases", "custom", "date", "status", "tags", "timeline"]);
  });

  it("returns candidates only for a selected field", () => {
    const candidates = { status: ["Draft", "Done"] };

    expect(frontmatterValueCandidatesForField(candidates, "status")).toEqual(["Draft", "Done"]);
    expect(frontmatterValueCandidatesForField(candidates, "missing")).toEqual([]);
    expect(frontmatterValueCandidatesForField(candidates, "")).toEqual([]);
  });

  it("detects active filtering state", () => {
    expect(isFilteringCards({ isSearching: false, query: "  ", searchError: null })).toBe(false);
    expect(isFilteringCards({ isSearching: false, query: "note", searchError: null })).toBe(true);
    expect(isFilteringCards({ isSearching: true, query: "", searchError: null })).toBe(true);
    expect(isFilteringCards({ isSearching: false, query: "", searchError: "Bad regex" })).toBe(true);
  });

  it("labels search modes through translations", () => {
    const t = createTranslator("en");
    const options = cardSearchModeOptions(t);

    expect(options.map((option) => option.mode)).toEqual([
      "fullText",
      "cardName",
      "tag",
      "frontmatter",
      "regex"
    ]);
    expect(activeCardSearchModeLabel(options, "frontmatter", "Full text")).toBe("Property");
    expect(activeCardSearchModeLabel(options, "fullText", "Full text")).toBe("Full text");
  });
});
