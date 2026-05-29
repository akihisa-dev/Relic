import { describe, expect, it } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { isEditorSettingsInput } from "./editorHandlerValidators";

describe("editorHandlerValidators", () => {
  it("validates complete editor settings before saving", () => {
    expect(isEditorSettingsInput(defaultEditorSettings)).toBe(true);
    expect(isEditorSettingsInput({ ...defaultEditorSettings, language: "ja", theme: "dark" })).toBe(true);
    expect(isEditorSettingsInput({ ...defaultEditorSettings, language: "fr" })).toBe(false);
    expect(isEditorSettingsInput({ ...defaultEditorSettings, theme: "blue" })).toBe(false);
    expect(isEditorSettingsInput({ ...defaultEditorSettings, fontSize: 0 })).toBe(false);
    expect(isEditorSettingsInput({ ...defaultEditorSettings, lineHeight: Number.NaN })).toBe(false);
    expect(isEditorSettingsInput({ ...defaultEditorSettings, theme: undefined })).toBe(false);
  });
});
