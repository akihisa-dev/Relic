import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { useAppFileSaved } from "./useAppFileSaved";
import { useWorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

describe("useAppFileSaved", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.relic = undefined;
  });

  it("保存後はworkspace stateを再取得せず、派生データ更新だけを一度実行する", async () => {
    const onWorkspaceDataChanged = vi.fn().mockResolvedValue(true);
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn()
    });
    const { result } = renderHook(() => {
      const guard = useWorkspaceRequestGuard("workspace-a");
      const onFileSaved = useAppFileSaved({
        beginWorkspaceRequest: guard.beginWorkspaceRequest,
        onWorkspaceDataChanged
      });
      return { guard, onFileSaved };
    });

    act(() => result.current.onFileSaved("Note.md"));
    await waitForPromise();

    expect(window.relic?.getWorkspaceState).not.toHaveBeenCalled();
    expect(onWorkspaceDataChanged).toHaveBeenCalledOnce();
  });
});

async function waitForPromise(): Promise<void> {
  await Promise.resolve();
}
