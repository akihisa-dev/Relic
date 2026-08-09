import { describe, expect, it } from "vitest";

import { isWorkspaceIdInput } from "./inputValidation";
import {
  isChronicleCalendarSettingsInput,
  isFrontmatterCategoryChoicesInput,
  isFrontmatterTemplatesInput,
  isSaveWorkspaceChronicleCalendarSettingsInput,
  isSaveWorkspaceFrontmatterCategoryChoicesInput,
  isUserDefinedFieldsInput
} from "./workspacePreferenceHandlerValidators";
import {
  isRefreshWorkspaceInput,
  isRenameWorkspaceInput,
  isSwitchWorkspaceInput
} from "./workspaceRegistrationHandlerValidators";
import {
  isChartsInput,
  isSaveWorkspaceTablePreferencesInput,
  isWorkspaceTablePreferencesInput,
  isUpdateChartEntryInput
} from "./workspaceVisualizationHandlerValidators";

describe("workspaceHandlerValidators", () => {
  it("暦名の重複、0年、表示対象なしを拒否する", () => {
    expect(isChronicleCalendarSettingsInput({
      baseCalendarName: "基準暦",
      calendars: [{ name: "別暦", range: { end: 100, start: 1 }, yearOne: 450 }],
      visibleCalendarNames: ["基準暦", "別暦"]
    })).toBe(true);
    expect(isChronicleCalendarSettingsInput({ baseCalendarName: "基準暦", calendars: [{ name: "別暦", range: null, yearOne: 0 }], visibleCalendarNames: ["基準暦"] })).toBe(false);
    expect(isChronicleCalendarSettingsInput({ baseCalendarName: "基準暦", calendars: [{ name: "基準暦", range: null, yearOne: 1 }], visibleCalendarNames: ["基準暦"] })).toBe(false);
    expect(isChronicleCalendarSettingsInput({ baseCalendarName: "基準暦", calendars: [], visibleCalendarNames: [] })).toBe(false);
    expect(isChronicleCalendarSettingsInput({ baseCalendarName: "基準暦", calendars: [{ name: "別暦", range: { end: 1, start: 10 }, yearOne: 1 }], visibleCalendarNames: ["基準暦"] })).toBe(false);
    expect(isChronicleCalendarSettingsInput({ baseCalendarName: "基準暦", calendars: [{ name: "別暦", range: { end: Number.MAX_VALUE, start: 1 }, yearOne: 1 }], visibleCalendarNames: ["基準暦"] })).toBe(false);
  });

  it("テーブル表示設定は列、幅、絞り込みの不正入力を拒否する", () => {
    const valid = {
      columnWidths: [{ property: "status", width: 240 }],
      fileColumnWidth: 280,
      filters: [{ operator: "contains", property: "status", target: "property", value: "draft" }],
      selectedProperties: ["status", "tags"],
      sort: { direction: "asc", property: "status" },
      wrappedProperties: ["status"]
    };
    expect(isWorkspaceTablePreferencesInput(valid)).toBe(true);
    expect(isWorkspaceTablePreferencesInput({ ...valid, selectedProperties: ["status", "status"] })).toBe(false);
    expect(isWorkspaceTablePreferencesInput({ ...valid, fileColumnWidth: 20 })).toBe(false);
    expect(isWorkspaceTablePreferencesInput({ ...valid, columnWidths: [{ property: "missing", width: 240 }] })).toBe(false);
    expect(isWorkspaceTablePreferencesInput({ ...valid, filters: [{ operator: "contains", target: "property" }] })).toBe(false);
  });
  it("validates user defined fields and rejects duplicates or reserved names", () => {
    expect(isUserDefinedFieldsInput([{ name: "rating", type: "number" }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "date", type: "date" }])).toBe(true);
    expect(isUserDefinedFieldsInput([{ name: "rating", type: "number" }, { name: "rating", type: "text" }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "tags", type: "text" }])).toBe(false);
    expect(isUserDefinedFieldsInput([{ name: "category", type: "text" }])).toBe(false);
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

  it("validates workspace category choices", () => {
    expect(isFrontmatterCategoryChoicesInput(["政治", "戦争"])).toBe(true);
    expect(isFrontmatterCategoryChoicesInput([" 政治"])).toBe(false);
    expect(isFrontmatterCategoryChoicesInput([""])).toBe(false);
    expect(isFrontmatterCategoryChoicesInput(["政治", "政治"])).toBe(false);
    expect(isFrontmatterCategoryChoicesInput(["政治", 1])).toBe(false);
  });

  it("ワークスペース設定保存は所有IDと入れ子payloadを一体で検証する", () => {
    const calendarSettings = {
      baseCalendarName: "基準暦",
      calendars: [],
      visibleCalendarNames: ["基準暦"]
    };
    const preferences = {
      columnWidths: [],
      fileColumnWidth: 280,
      filters: [],
      selectedProperties: [],
      sort: { direction: "asc" as const, property: null },
      wrappedProperties: []
    };
    expect(isSaveWorkspaceFrontmatterCategoryChoicesInput({ choices: ["政治"], workspaceId: "workspace-a" })).toBe(true);
    expect(isSaveWorkspaceFrontmatterCategoryChoicesInput({ choices: ["政治"], workspaceId: "../outside" })).toBe(false);
    expect(isSaveWorkspaceFrontmatterCategoryChoicesInput(["政治"])).toBe(false);
    expect(isSaveWorkspaceChronicleCalendarSettingsInput({ settings: calendarSettings, workspaceId: "workspace-a" })).toBe(true);
    expect(isSaveWorkspaceChronicleCalendarSettingsInput({ settings: { ...calendarSettings, visibleCalendarNames: [] }, workspaceId: "workspace-a" })).toBe(false);
    expect(isSaveWorkspaceTablePreferencesInput({ preferences, workspaceId: "workspace-a" })).toBe(true);
    expect(isSaveWorkspaceTablePreferencesInput({ preferences: { ...preferences, fileColumnWidth: 20 }, workspaceId: "workspace-a" })).toBe(false);
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
    expect(isWorkspaceIdInput({ workspaceId: "workspace-1" })).toBe(true);
    expect(isSwitchWorkspaceInput({ workspaceId: "workspace-1" })).toBe(true);
    expect(isRefreshWorkspaceInput({ workspaceId: "workspace-1" })).toBe(true);
    expect(isSwitchWorkspaceInput({ workspaceId: "workspace_1" })).toBe(true);
    expect(isRefreshWorkspaceInput({ workspaceId: "../outside" })).toBe(false);
    expect(isSwitchWorkspaceInput({ workspaceId: "" })).toBe(false);
    expect(isSwitchWorkspaceInput({ workspaceId: "  " })).toBe(false);
    expect(isSwitchWorkspaceInput({ workspaceId: "../outside" })).toBe(false);
    expect(isSwitchWorkspaceInput({ workspaceId: "folder/workspace" })).toBe(false);
    expect(isSwitchWorkspaceInput({ workspaceId: 1 })).toBe(false);
  });
});
