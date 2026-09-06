import { act, renderHook } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { makeWorkspaceState } from "../../test/rendererTestUtils";
import { useWorkspaceSession } from "./useWorkspaceSession";

describe("useWorkspaceSession", () => {
  it("切替成功から再描画まで旧画面のcallbackによる要求を拒否する", () => {
    const { result } = renderHook(() => useWorkspaceSession(makeWorkspaceState("a")));
    const beginFromA = result.current.beginWorkspaceRequest;
    let currentB!: () => boolean;
    act(() => {
      result.current.invalidateWorkspaceRequests("b");
      expect(beginFromA()()).toBe(false);
      currentB = result.current.beginWorkspaceRequestFor("b");
      result.current.setWorkspaceState(makeWorkspaceState("b"));
    });
    expect(currentB()).toBe(true);
    expect(result.current.beginWorkspaceRequest()()).toBe(true);
    expect(result.current.workspaceState?.activeWorkspace?.id).toBe("b");
  });

  it("IDと派生データ世代を同時に通知して切替先を二重取得しない", () => {
    const load = vi.fn();
    const { result } = renderHook(() => {
      const session = useWorkspaceSession(makeWorkspaceState("a"));
      const id = session.workspaceState?.activeWorkspace?.id;
      useEffect(() => { load(id, session.workspaceDataRevision); }, [id, session.workspaceDataRevision]);
      return session;
    });

    act(() => result.current.setWorkspaceState(makeWorkspaceState("b")));
    expect(load.mock.calls).toEqual([["a", 0], ["b", 1]]);
  });

  it("画面を破棄した後は未完了の要求を適用させない", () => {
    const { result, unmount } = renderHook(() => useWorkspaceSession(makeWorkspaceState("a")));
    const current = result.current.beginWorkspaceRequest();
    unmount();
    expect(current()).toBe(false);
  });
});
