import { describe, expect, it } from "vitest";

import {
  isFrontmatterTemplatesInput,
  isChronicleCalendarsInput,
  isChartsInput,
  isRenameWorkspaceInput,
  isUpdateChartEntryInput,
  isUserDefinedFieldsInput
} from "./workspaceHandlerValidators";

describe("workspaceHandlerValidators", () => {
  it("validates user defined fields and rejects duplicates or reserved names", () => {
    expect(isUserDefinedFieldsInput([{ name: "rating", type: "number" }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "date", type: "date" }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "rating", type: "number" }, { name: "rating", type: "text" }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "tags", type: "text" }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "chronicle0", type: "number" }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: ["a", "b"] }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: [1] }])).toBe(false);
  });

  it("validates the two required chart chart sources", () => {
    expect(isChartsInput([
      { id: "chronicle", name: "Chronicle", source: "chronicle" },
      { id: "date", name: "Date", source: "date", filePaths: ["a.md"] }
    ])).toBe(true);
    expect(isChartsInput([
      { id: "a", name: "A", source: "chronicle" },
      { id: "b", name: "B", source: "chronicle" }
    ])).toBe(false);
  });

  it("validates chart entry edits and frontmatter templates", () => {
    expect(isUpdateChartEntryInput({
      chronicleCalendarId: "chronicle1",
      chronicleCalendarStartYear: 100,
      endValue: 3,
      kind: "move",
      originalEndValue: 2,
      originalStartValue: 1,
      path: "Note.md",
      source: "chronicle",
      startValue: 2
    })).toBe(true);
    expect(isUpdateChartEntryInput({
      chronicleCalendarId: "chronicle1",
      chronicleCalendarStartYear: 0,
      endValue: 3,
      kind: "move",
      originalEndValue: 2,
      originalStartValue: 1,
      path: "Note.md",
      source: "chronicle",
      startValue: 2
    })).toBe(false);
    expect(isUpdateChartEntryInput({
      endValue: 1,
      kind: "move",
      originalEndValue: 2,
      originalStartValue: 1,
      path: "Note.md",
      source: "date",
      startValue: 2
    })).toBe(false);
    expect(isFrontmatterTemplatesInput([{ fieldNames: ["status"], name: "Basic" }])).toBe(true);
    expect(isFrontmatterTemplatesInput([{ fieldNames: [], name: "Basic" }])).toBe(false);
  });

  it("validates chronicle calendar settings", () => {
    expect(isChronicleCalendarsInput([
      { id: "chronicle0", name: "Main" },
      { id: "chronicle1", name: "Sub", startYear: 100 }
    ])).toBe(true);
    expect(isChronicleCalendarsInput([
      { id: "chronicle0", name: "Main" },
      { id: "chronicle1", name: "Sub" },
      { id: "chronicle2", name: "", startYear: 100 }
    ])).toBe(true);
    expect(isChronicleCalendarsInput([{ id: "chronicle1", name: "Sub", startYear: 100 }])).toBe(false);
    expect(isChronicleCalendarsInput([{ id: "chronicle0", name: "" }])).toBe(true);
    expect(isChronicleCalendarsInput([
      { id: "chronicle0", name: "Main" },
      { id: "chronicle1", name: "Sub", startYear: 0 }
    ])).toBe(false);
  });

  it("validates workspace rename input", () => {
    expect(isRenameWorkspaceInput({ name: "Journal", workspaceId: "workspace-1" })).toBe(true);
    expect(isRenameWorkspaceInput({ workspaceId: "workspace-1" })).toBe(false);
  });
});
