import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  defaultEditorSettings,
  type UserDefinedField,
  type WorkspaceState
} from "../../shared/ipc";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { useAppSettingsState } from "./useAppSettingsState";

const beginCurrentWorkspaceRequest = () => () => true;

describe("useAppSettingsState", () => {
  const editorSettings = {
    ...defaultEditorSettings,
    language: "ja" as const,
    fontSize: 18
  };
  const userDefinedFields: UserDefinedField[] = [{ name: "category", type: "text" }];
  afterEach(() => {
    window.relic = undefined;
    vi.clearAllMocks();
  });

  it("起動時に画面から利用されないフロントマター雛形を読み込まない", async () => {
    const api = makeRelicApi()!;
    window.relic = api;

    renderHook(() => useAppSettingsState({
      beginWorkspaceRequest: beginCurrentWorkspaceRequest,
      setEditorSettings: vi.fn(),
      setWorkspaceError: vi.fn(),
      setWorkspaceState: vi.fn()
    }));

    await waitFor(() => {
      expect(api.getAppInfo).toHaveBeenCalledOnce();
      expect(api.getWorkspaceState).toHaveBeenCalledOnce();
      expect(api.getEditorSettings).toHaveBeenCalledOnce();
      expect(api.getUserDefinedFields).toHaveBeenCalledOnce();
    });
    expect(api.getFrontmatterTemplates).not.toHaveBeenCalled();
  });

  it("初期workspace取得後に切替済みなら古い状態を反映しない", async () => {
    const workspaceState = deferred<{
      ok: true;
      value: WorkspaceState;
    }>();
    let currentWorkspace = true;
    const beginWorkspaceRequest = () => () => currentWorkspace;
    const setEditorSettings = vi.fn();
    const setWorkspaceError = vi.fn();
    const setWorkspaceState = vi.fn();
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockReturnValue(workspaceState.promise)
    });

    renderHook(() => useAppSettingsState({
      beginWorkspaceRequest,
      setEditorSettings,
      setWorkspaceError,
      setWorkspaceState
    }));

    currentWorkspace = false;
    await act(async () => {
      workspaceState.resolve({
        ok: true,
        value: {
          activeWorkspace: { id: "workspace-a", name: "A", path: "/tmp/A" },
          fileTree: [],
          pinnedPaths: [],
          workspaces: []
        }
      });
      await workspaceState.promise;
    });

    expect(setWorkspaceState).not.toHaveBeenCalled();
  });

  it("workspace切替でguard関数が変わっても初期化IPCを再実行しない", async () => {
    const api = makeRelicApi()!;
    const setEditorSettings = vi.fn();
    const setWorkspaceError = vi.fn();
    const setWorkspaceState = vi.fn();
    window.relic = api;
    const { rerender } = renderHook(
      ({ beginWorkspaceRequest }) => useAppSettingsState({
        beginWorkspaceRequest,
        setEditorSettings,
        setWorkspaceError,
        setWorkspaceState
      }),
      { initialProps: { beginWorkspaceRequest: beginCurrentWorkspaceRequest } }
    );

    await waitFor(() => expect(api.getWorkspaceState).toHaveBeenCalledOnce());
    rerender({ beginWorkspaceRequest: () => () => true });

    expect(api.getAppInfo).toHaveBeenCalledOnce();
    expect(api.getWorkspaceState).toHaveBeenCalledOnce();
    expect(api.getEditorSettings).toHaveBeenCalledOnce();
    expect(api.getUserDefinedFields).toHaveBeenCalledOnce();
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
      beginWorkspaceRequest: beginCurrentWorkspaceRequest,
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
      beginWorkspaceRequest: beginCurrentWorkspaceRequest,
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

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}
