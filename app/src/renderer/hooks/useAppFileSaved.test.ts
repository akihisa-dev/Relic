import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceState } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { useAppFileSaved } from "./useAppFileSaved";
import { useWorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

describe("useAppFileSaved", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.relic = undefined;
  });

  it("workspace切替後に完了した状態再取得を反映しない", async () => {
    const pendingState = deferred<RelicResult<WorkspaceState>>();
    const setWorkspaceError = vi.fn();
    const setWorkspaceState = vi.fn();
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockReturnValue(pendingState.promise)
    });
    const { result } = renderHook(() => {
      const guard = useWorkspaceRequestGuard("workspace-a");
      const onFileSaved = useAppFileSaved({
        beginWorkspaceRequest: guard.beginWorkspaceRequest,
        hasOpenChart: false,
        reloadCharts: vi.fn().mockResolvedValue(true),
        setWorkspaceError,
        setWorkspaceState
      });
      return { guard, onFileSaved };
    });

    act(() => result.current.onFileSaved("Note.md"));
    act(() => result.current.guard.invalidateWorkspaceRequests("workspace-b"));
    await act(async () => {
      pendingState.resolve({
        ok: true,
        value: {
          activeWorkspace: { id: "workspace-a", name: "A", path: "/tmp/A" },
          fileTree: [],
          pinnedPaths: [],
          workspaces: []
        }
      });
      await pendingState.promise;
    });

    expect(setWorkspaceState).not.toHaveBeenCalled();
    expect(setWorkspaceError).not.toHaveBeenCalled();
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
