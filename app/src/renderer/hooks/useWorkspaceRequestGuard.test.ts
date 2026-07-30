import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";

import type { IsCurrentRequest } from "./useAsyncRequestGuard";
import { useWorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

describe("useWorkspaceRequestGuard", () => {
  it("active workspaceが変わったrender中に旧要求を同期的に無効化する", () => {
    const checksDuringRender: boolean[] = [];
    const { rerender } = renderHook(
      ({ workspaceId }) => {
        const guard = useWorkspaceRequestGuard(workspaceId);
        const previousRequestRef = useRef<IsCurrentRequest | null>(null);
        if (previousRequestRef.current) {
          checksDuringRender.push(previousRequestRef.current());
        } else {
          previousRequestRef.current = guard.beginWorkspaceRequest();
        }
      },
      { initialProps: { workspaceId: "workspace-a" as string | null } }
    );

    rerender({ workspaceId: "workspace-b" });

    expect(checksDuringRender).toEqual([false]);
  });

  it("workspace stateをcommitする直前にも明示的に旧要求を無効化できる", () => {
    const { result } = renderHook(() => useWorkspaceRequestGuard("workspace-a"));
    const isCurrentRequest = result.current.beginWorkspaceRequest();

    act(() => result.current.invalidateWorkspaceRequests());

    expect(isCurrentRequest()).toBe(false);
  });

  it("切替成功から再描画まで旧workspaceの新規要求も拒否する", () => {
    const { result, rerender } = renderHook(
      ({ workspaceId }) => useWorkspaceRequestGuard(workspaceId),
      { initialProps: { workspaceId: "workspace-a" } }
    );
    const beginFromWorkspaceA = result.current.beginWorkspaceRequest;

    act(() => result.current.invalidateWorkspaceRequests("workspace-b"));

    expect(beginFromWorkspaceA()()).toBe(false);
    const workspaceBRequestBeforeRender = result.current.beginWorkspaceRequestFor("workspace-b");
    expect(workspaceBRequestBeforeRender()).toBe(true);

    rerender({ workspaceId: "workspace-b" });
    expect(workspaceBRequestBeforeRender()).toBe(true);
    expect(result.current.beginWorkspaceRequest()()).toBe(true);
  });
});
