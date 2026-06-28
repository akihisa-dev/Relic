import { describe, expect, it } from "vitest";

import {
  isFeatureTogglesInput,
  isFrontmatterTemplatesInput,
  isChronicleCalendarsInput,
  isChartsInput,
  isRenameWorkspaceInput,
  isSwitchWorkspaceInput,
  isUpdateChartEntryInput,
  isUserDefinedFieldsInput
} from "./workspaceHandlerValidators";

describe("workspaceHandlerValidators", () => {
  it("validates user defined fields and rejects duplicates or reserved names", () => {
    expect(isUserDefinedFieldsInput([{ name: "rating", type: "number" }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "date", type: "date" }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "rating", type: "number" }, { name: "rating", type: "text" }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "tags", type: "text" }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "chronicle", type: "number" }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "chronicle0", type: "number" }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "plannedDate", type: "date" }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "actualDate", type: "date" }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: ["a", "b"] }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: [1] }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "text", choices: ["a"] }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: ["a", "a"] }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: [" a "] }])).toBe(false);
  });

  it("validates the required chronicle chart source", () => {
    expect(isChartsInput([
      { id: "chronicle", name: "Chronicle", source: "chronicle" }
    ])).toBe(true);
    expect(isChartsInput([
      { id: "a", name: "A", source: "chronicle" },
      { id: "b", name: "B", source: "chronicle" }
    ])).toBe(false);
    expect(isChartsInput([
      { id: "chronicle", name: "Chronicle", source: "chronicle", filePaths: ["../outside.md"] }
    ])).toBe(false);
    expect(isChartsInput([
      { id: "chronicle", name: "Chronicle", source: "chronicle", filePaths: ["/tmp/outside.md"] }
    ])).toBe(false);
    expect(isChartsInput([
      { id: "chronicle", name: "Chronicle", source: "chronicle", filePaths: ["section/../a.md"] }
    ])).toBe(false);
  });

  it("validates chart entry edits and frontmatter templates", () => {
    expect(isUpdateChartEntryInput({
      chronicleEntryIndex: 1,
      endValue: 3,
      kind: "move",
      originalEndValue: 2,
      originalStartValue: 1,
      path: "Note.md",
      source: "chronicle",
      startValue: 2
    })).toBe(true);
    expect(isUpdateChartEntryInput({
      chronicleEntryIndex: -1,
      endValue: 3,
      kind: "move",
      originalEndValue: 2,
      originalStartValue: 1,
      path: "Note.md",
      source: "chronicle",
      startValue: 2
    })).toBe(false);
    expect(isUpdateChartEntryInput({
      chronicleEntryIndex: 0,
      endValue: 3,
      kind: "move",
      originalEndValue: 2,
      originalStartValue: 1,
      path: "Note.md",
      source: "chronicle",
      startValue: 2
    })).toBe(true);
    expect(isUpdateChartEntryInput({
      chronicleEntryIndex: 0,
      endValue: 3,
      kind: "move",
      originalEndValue: 2,
      originalStartValue: 1,
      path: "../outside.md",
      source: "chronicle",
      startValue: 2
    })).toBe(false);
    expect(isUpdateChartEntryInput({
      chronicleEntryIndex: 0,
      endValue: 3,
      kind: "move",
      originalEndValue: 2,
      originalStartValue: 1,
      path: " Notes/Idea.md ",
      source: "chronicle",
      startValue: 2
    })).toBe(false);
    expect(isFrontmatterTemplatesInput([{ fieldNames: ["status"], name: "Basic" }])).toBe(true);
    expect(isFrontmatterTemplatesInput([{ fieldNames: [], name: "Basic" }])).toBe(false);
  });

  it("validates feature toggles before saving", () => {
    expect(isFeatureTogglesInput({
      chronicle: false,
      chronicleSettings: false,
      frontmatter: true,
      rightPanelLinks: true,
      rightPanelOutline: true,
      tools: false
    })).toBe(true);
    expect(isFeatureTogglesInput({
      chronicle: false,
      chronicleSettings: false,
      frontmatter: true,
      rightPanelLinks: true,
      rightPanelOutline: true,
      tools: "false"
    })).toBe(false);
    expect(isFeatureTogglesInput({
      chronicle: false,
      frontmatter: true,
      rightPanelLinks: true,
      rightPanelOutline: true,
      tools: false
    })).toBe(false);
  });

  it("validates chronicle calendar settings", () => {
    expect(isChronicleCalendarsInput([
      { name: "Main" },
      { name: "Sub", startYear: 100 }
    ])).toBe(true);
    expect(isChronicleCalendarsInput([
      { name: "Main" },
      { name: "Sub" },
      { name: "", startYear: 100 }
    ])).toBe(false);
    expect(isChronicleCalendarsInput([{ name: "Sub", startYear: 100 }])).toBe(true);
    expect(isChronicleCalendarsInput([{ name: "" }])).toBe(false);
    expect(isChronicleCalendarsInput([{ name: "Main" }, { name: "Main", startYear: 100 }])).toBe(false);
    expect(isChronicleCalendarsInput([
      { name: "Main" },
      { name: "Sub", startYear: 0 }
    ])).toBe(false);
  });

  it("validates workspace rename input", () => {
    expect(isRenameWorkspaceInput({ name: "Journal", workspaceId: "workspace-1" })).toBe(true);
    expect(isRenameWorkspaceInput({ name: "Journal", workspaceId: "workspace_1" })).toBe(true);
    expect(isRenameWorkspaceInput({ workspaceId: "workspace-1" })).toBe(false);
    expect(isRenameWorkspaceInput({ name: "Journal", workspaceId: "" })).toBe(false);
    expect(isRenameWorkspaceInput({ name: "Journal", workspaceId: "  " })).toBe(false);
    expect(isRenameWorkspaceInput({ name: "Journal", workspaceId: " ../outside " })).toBe(false);
    expect(isRenameWorkspaceInput({ name: "Journal", workspaceId: "folder/workspace" })).toBe(false);
  });

  it("validates workspace switch input with a safe workspace id", () => {
    expect(isSwitchWorkspaceInput({ workspaceId: "workspace-1" })).toBe(true);
    expect(isSwitchWorkspaceInput({ workspaceId: "workspace_1" })).toBe(true);
    expect(isSwitchWorkspaceInput({ workspaceId: "" })).toBe(false);
    expect(isSwitchWorkspaceInput({ workspaceId: "  " })).toBe(false);
    expect(isSwitchWorkspaceInput({ workspaceId: "../outside" })).toBe(false);
    expect(isSwitchWorkspaceInput({ workspaceId: "folder/workspace" })).toBe(false);
    expect(isSwitchWorkspaceInput({ workspaceId: 1 })).toBe(false);
  });
});
