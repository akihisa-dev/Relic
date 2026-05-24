import { describe, expect, it } from "vitest";

import {
  isFrontmatterTemplatesInput,
  isGanttChartsInput,
  isRenameWorkspaceInput,
  isUpdateGanttChartEntryInput,
  isUserDefinedFieldsInput
} from "./workspaceHandlerValidators";

describe("workspaceHandlerValidators", () => {
  it("validates user defined fields and rejects duplicates or reserved names", () => {
    expect(isUserDefinedFieldsInput([{ name: "rating", type: "number" }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "date", type: "date" }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "rating", type: "number" }, { name: "rating", type: "text" }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "tags", type: "text" }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: ["a", "b"] }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: [1] }])).toBe(false);
  });

  it("validates the two required gantt chart sources", () => {
    expect(isGanttChartsInput([
      { id: "chronicle", name: "Chronicle", source: "chronicle" },
      { id: "date", name: "Date", source: "date", filePaths: ["a.md"] }
    ])).toBe(true);
    expect(isGanttChartsInput([
      { id: "a", name: "A", source: "chronicle" },
      { id: "b", name: "B", source: "chronicle" }
    ])).toBe(false);
  });

  it("validates gantt entry edits and frontmatter templates", () => {
    expect(isUpdateGanttChartEntryInput({
      endValue: 3,
      kind: "move",
      originalEndValue: 2,
      originalStartValue: 1,
      path: "Note.md",
      source: "date",
      startValue: 2
    })).toBe(true);
    expect(isUpdateGanttChartEntryInput({
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

  it("validates workspace rename input", () => {
    expect(isRenameWorkspaceInput({ name: "Journal", workspaceId: "workspace-1" })).toBe(true);
    expect(isRenameWorkspaceInput({ workspaceId: "workspace-1" })).toBe(false);
  });
});
