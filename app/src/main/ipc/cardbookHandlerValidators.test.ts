import { describe, expect, it } from "vitest";

import {
  isFrontmatterTemplatesInput,
  isTimelineChartsInput,
  isRenameCardbookInput,
  isUpdateTimelineChartEntryInput,
  isUserDefinedFieldsInput
} from "./cardbookHandlerValidators";

describe("cardbookHandlerValidators", () => {
  it("validates user defined fields and rejects duplicates or reserved names", () => {
    expect(isUserDefinedFieldsInput([{ name: "rating", type: "number" }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "date", type: "date" }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "rating", type: "number" }, { name: "rating", type: "text" }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "tags", type: "text" }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: ["a", "b"] }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: [1] }])).toBe(false);
  });

  it("validates the required timeline chart source", () => {
    expect(isTimelineChartsInput([
      { id: "timeline", name: "Timeline", source: "timeline", cardPaths: ["a.md"] }
    ])).toBe(true);
    expect(isTimelineChartsInput([
      { id: "a", name: "A", source: "timeline" },
      { id: "b", name: "B", source: "timeline" }
    ])).toBe(false);
  });

  it("validates timeline entry edits and frontmatter templates", () => {
    expect(isUpdateTimelineChartEntryInput({
      endValue: 3,
      kind: "move",
      originalEndValue: 2,
      originalStartValue: 1,
      path: "Note.md",
      source: "timeline",
      startValue: 2
    })).toBe(true);
    expect(isUpdateTimelineChartEntryInput({
      endValue: 1,
      kind: "move",
      originalEndValue: 2,
      originalStartValue: 1,
      path: "Note.md",
      source: "timeline",
      startValue: 2
    })).toBe(false);
    expect(isFrontmatterTemplatesInput([{ fieldNames: ["status"], name: "Basic" }])).toBe(true);
    expect(isFrontmatterTemplatesInput([{ fieldNames: [], name: "Basic" }])).toBe(false);
  });

  it("validates cardbook rename input", () => {
    expect(isRenameCardbookInput({ name: "Journal", cardbookId: "cardbook-1" })).toBe(true);
    expect(isRenameCardbookInput({ cardbookId: "cardbook-1" })).toBe(false);
  });
});
