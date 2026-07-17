import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi, testWorkspaceState } from "../../test/rendererTestUtils";
import { useWorkspaceRegistryActions } from "./useWorkspaceRegistryActions";

describe("useWorkspaceRegistryActions", () => {
  afterEach(() => {
    window.relic = undefined;
  });

  it("非アクティブなワークスペースを一覧から外しても現在のタブを閉じない", async () => {
    const beforeCloseAllTabs = vi.fn().mockReturnValue(true);
    const closeAllTabs = vi.fn();
    const setWorkspaceState = vi.fn();
    window.relic = makeRelicApi({
      removeWorkspace: vi.fn().mockResolvedValue({ ok: true, value: testWorkspaceState })
    });

    const { result } = renderHook(() => useWorkspaceRegistryActions({
      activeWorkspaceId: "ws-active",
      beforeCloseAllTabs,
      closeAllTabs,
      setWorkspaceError: vi.fn(),
      setWorkspaceState
    }));

    act(() => result.current.handleRemoveWorkspace("ws-other"));

    await waitFor(() => expect(setWorkspaceState).toHaveBeenCalledWith(testWorkspaceState));
    expect(beforeCloseAllTabs).not.toHaveBeenCalled();
    expect(closeAllTabs).not.toHaveBeenCalled();
  });
});
