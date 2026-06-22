import { describe, expect, it } from "vitest";

import { createTranslator } from "./i18nModel";
import {
  formatYamlExample,
  isFieldNameAvailable,
  needsChoices,
  nextExpandedFieldAfterDelete,
  parseChoiceInput,
  uniqueChoices
} from "./frontmatterSettingsModel";

const t = createTranslator("en");

describe("frontmatterSettingsModel", () => {
  it("parses and deduplicates choice input", () => {
    expect(parseChoiceInput("draft, review\n done ,,")).toEqual(["draft", "review", "done"]);
    expect(uniqueChoices(["draft", "draft", "done"])).toEqual(["draft", "done"]);
  });

  it("detects field types that need choices", () => {
    expect(needsChoices("select")).toBe(true);
    expect(needsChoices("multi-select")).toBe(true);
    expect(needsChoices("text")).toBe(false);
  });

  it("validates custom field names against reserved names and duplicates", () => {
    const fields = [{ name: "phase", type: "text" as const }];

    expect(isFieldNameAvailable(fields, "deadline")).toBe(true);
    expect(isFieldNameAvailable(fields, "date")).toBe(true);
    expect(isFieldNameAvailable(fields, "phase")).toBe(false);
    expect(isFieldNameAvailable(fields, "phase", 0)).toBe(true);
    expect(isFieldNameAvailable(fields, "tags")).toBe(false);
    expect(isFieldNameAvailable(fields, "plannedDate")).toBe(true);
    expect(isFieldNameAvailable(fields, "actualDate")).toBe(true);
    expect(isFieldNameAvailable(fields, " bad")).toBe(false);
    expect(isFieldNameAvailable(fields, "bad:name")).toBe(false);
  });

  it("formats YAML examples for representative field types", () => {
    expect(formatYamlExample("", "text", [], t)).toBe("status: [note]");
    expect(formatYamlExample("published", "boolean", [], t)).toBe("published: [true]");
    expect(formatYamlExample("deadline", "date", [], t)).toBe("deadline: [2026-05-20]");
    expect(formatYamlExample("phase", "select", ["draft"], t)).toBe("phase: [draft]");
    expect(formatYamlExample("characters", "multi-select", ["Alice", "Bob"], t)).toBe("characters: [Alice, Bob]");
    expect(formatYamlExample("source", "url", [], t)).toBe("source: [https://example.com]");
  });

  it("selects the next expanded field after delete", () => {
    const fields = [
      { name: "first", type: "text" as const },
      { name: "third", type: "text" as const }
    ];

    expect(nextExpandedFieldAfterDelete(fields, 0)).toBe("first");
    expect(nextExpandedFieldAfterDelete(fields, 1)).toBe("third");
    expect(nextExpandedFieldAfterDelete([], 0)).toBeNull();
  });
});
