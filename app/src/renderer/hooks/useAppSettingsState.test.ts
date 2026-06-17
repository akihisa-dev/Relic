import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings, type FrontmatterTemplate, defaultFeatureToggles, type UserDefinedField } from "../../shared/ipc";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { useAppSettingsState } from "./useAppSettingsState";

describe("useAppSettingsState", () => {
  const editorSettings = {
    ...defaultEditorSettings,
    language: "ja" as const,
    fontSize: 18
  };
  const featureToggles = {
    ...defaultFeatureToggles,
    tools: true
  };
  const userDefinedFields: UserDefinedField[] = [{ name: "category", type: "text" }];
  const frontmatterTemplates: FrontmatterTemplate[] = [{
    fieldNames: ["status", "tags"],
    name: "記事"
  }];

  afterEach(() => {
    window.relic = undefined;
    vi.clearAllMocks();
  });

  it("設定保存失敗時に setWorkspaceError を呼ぶ", async () => {
    window.relic = makeRelicApi({
      saveEditorSettings: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "EDITOR_SETTINGS_SAVE_FAILED", message: "エディタ設定の保存に失敗しました" }
      })
    });

    const setEditorSettings = vi.fn();
    const setWorkspaceError = vi.fn();
    const setWorkspaceState = vi.fn();

    const { result } = renderHook(() => useAppSettingsState({
      setEditorSettings,
      setWorkspaceError,
      setWorkspaceState
    }));

    act(() => {
      result.current.handleSaveSettings(editorSettings);
    });

    expect(setEditorSettings).toHaveBeenCalledWith(editorSettings);
    await waitFor(() => {
      expect(setWorkspaceError).toHaveBeenCalledWith("エディタ設定の保存に失敗しました");
    });
  });

  it("機能トグル保存失敗時に setWorkspaceError を呼ぶ", async () => {
    window.relic = makeRelicApi({
      saveFeatureToggles: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "FEATURE_TOGGLES_SAVE_FAILED", message: "機能トグルの保存に失敗しました" }
      })
    });

    const setWorkspaceError = vi.fn();
    const setWorkspaceState = vi.fn();

    const { result } = renderHook(() => useAppSettingsState({
      setEditorSettings: vi.fn(),
      setWorkspaceError,
      setWorkspaceState
    }));

    act(() => {
      result.current.handleSaveFeatureToggles(featureToggles);
    });

    expect(result.current.featureToggles).toEqual(featureToggles);

    await waitFor(() => {
      expect(setWorkspaceError).toHaveBeenCalledWith("機能トグルの保存に失敗しました");
    });
  });

  it("フロントマター定義保存失敗時に setWorkspaceError を呼ぶ", async () => {
    window.relic = makeRelicApi({
      saveFrontmatterTemplates: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "FRONTMATTER_TEMPLATES_SAVE_FAILED", message: "フロントマター雛形の保存に失敗しました" }
      })
    });

    const setWorkspaceError = vi.fn();
    const setWorkspaceState = vi.fn();

    const { result } = renderHook(() => useAppSettingsState({
      setEditorSettings: vi.fn(),
      setWorkspaceError,
      setWorkspaceState
    }));

    act(() => {
      result.current.handleSaveFrontmatterTemplates(frontmatterTemplates);
    });

    expect(result.current.frontmatterTemplates).toEqual(frontmatterTemplates);

    await waitFor(() => {
      expect(setWorkspaceError).toHaveBeenCalledWith("フロントマター雛形の保存に失敗しました");
    });
  });

  it("ユーザー定義フィールド保存失敗時に setWorkspaceError を呼ぶ", async () => {
    window.relic = makeRelicApi({
      saveUserDefinedFields: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "USER_DEFINED_FIELDS_SAVE_FAILED", message: "カスタムフィールドの保存に失敗しました" }
      })
    });

    const setWorkspaceError = vi.fn();
    const setWorkspaceState = vi.fn();

    const { result } = renderHook(() => useAppSettingsState({
      setEditorSettings: vi.fn(),
      setWorkspaceError,
      setWorkspaceState
    }));

    act(() => {
      result.current.handleSaveUserDefinedFields(userDefinedFields);
    });

    expect(result.current.userDefinedFields).toEqual(userDefinedFields);

    await waitFor(() => {
      expect(setWorkspaceError).toHaveBeenCalledWith("カスタムフィールドの保存に失敗しました");
    });
  });
});
