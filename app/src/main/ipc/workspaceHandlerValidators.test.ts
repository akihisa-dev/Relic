import { describe, expect, it } from "vitest";

import {
  isFeatureTogglesInput,
  isFrontmatterTemplatesInput,
  isAppUiSettingsInput,
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
    expect(isUserDefinedFieldsInput([{ name: "chronicle0", type: "number" }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: ["a", "b"] }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: [1] }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "text", choices: ["a"] }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: ["a", "a"] }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "kind", type: "select", choices: [" a "] }])).toBe(false);
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
    expect(isChartsInput([
      { id: "chronicle", name: "Chronicle", source: "chronicle", filePaths: ["../outside.md"] },
      { id: "date", name: "Date", source: "date", filePaths: ["a.md"] }
    ])).toBe(false);
    expect(isChartsInput([
      { id: "chronicle", name: "Chronicle", source: "chronicle", filePaths: ["/tmp/outside.md"] },
      { id: "date", name: "Date", source: "date", filePaths: ["a.md"] }
    ])).toBe(false);
    expect(isChartsInput([
      { id: "chronicle", name: "Chronicle", source: "chronicle", filePaths: ["section/../a.md"] },
      { id: "date", name: "Date", source: "date", filePaths: ["a.md"] }
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
    expect(isUpdateChartEntryInput({
      endValue: 3,
      kind: "move",
      originalEndValue: 2,
      originalStartValue: 1,
      path: "../outside.md",
      source: "date",
      startValue: 2
    })).toBe(false);
    expect(isUpdateChartEntryInput({
      endValue: 3,
      kind: "move",
      originalEndValue: 2,
      originalStartValue: 1,
      path: " Notes/Idea.md ",
      source: "date",
      startValue: 2
    })).toBe(false);
    expect(isFrontmatterTemplatesInput([{ fieldNames: ["status"], name: "Basic" }])).toBe(true);
    expect(isFrontmatterTemplatesInput([{ fieldNames: [], name: "Basic" }])).toBe(false);
  });

  it("validates feature toggles before saving", () => {
    expect(isFeatureTogglesInput({
      ai: true,
      calendar: true,
      chronicle: false,
      chronicleSettings: false,
      frontmatter: true,
      rightPanelLinks: true,
      rightPanelOutline: true,
      tools: false
    })).toBe(true);
    expect(isFeatureTogglesInput({
      ai: true,
      calendar: true,
      chronicle: false,
      chronicleSettings: false,
      frontmatter: true,
      rightPanelLinks: true,
      rightPanelOutline: true,
      tools: "false"
    })).toBe(false);
    expect(isFeatureTogglesInput({
      ai: true,
      calendar: true,
      chronicle: false,
      frontmatter: true,
      rightPanelLinks: true,
      rightPanelOutline: true,
      tools: false
    })).toBe(false);
  });

  it("validates app UI settings before saving", () => {
    expect(isAppUiSettingsInput({ coworkPanelWidth: 320 })).toBe(true);
    expect(isAppUiSettingsInput({ coworkPanelWidth: 520 })).toBe(true);
    expect(isAppUiSettingsInput({ coworkPanelWidth: 319 })).toBe(false);
    expect(isAppUiSettingsInput({ coworkPanelWidth: 521 })).toBe(false);
    expect(isAppUiSettingsInput({ coworkPanelWidth: Number.NaN })).toBe(false);
    expect(isAppUiSettingsInput({ coworkPanelWidth: "400" })).toBe(false);
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
