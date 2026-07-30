import { act, renderHook } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { useWorkspaceDataRevision } from "./useWorkspaceDataRevision";

describe("useWorkspaceDataRevision", () => {
  it("ワークスペースのactivationごとに世代を進め、AからBを経たA再訪を別世代にする", () => {
    const { result, rerender } = renderHook(
      ({ workspaceId }) => useWorkspaceDataRevision(workspaceId),
      { initialProps: { workspaceId: "workspace-a" as string | null } }
    );
    expect(result.current.workspaceDataRevision).toBe(0);

    rerender({ workspaceId: "workspace-b" });
    expect(result.current.workspaceDataRevision).toBe(1);

    rerender({ workspaceId: "workspace-a" });
    expect(result.current.workspaceDataRevision).toBe(2);
  });

  it("同じワークスペースの再描画では世代を進めず、明示的なデータ変更では進める", () => {
    const { result, rerender } = renderHook(
      ({ workspaceId }) => useWorkspaceDataRevision(workspaceId),
      { initialProps: { workspaceId: "workspace-a" as string | null } }
    );

    rerender({ workspaceId: "workspace-a" });
    expect(result.current.workspaceDataRevision).toBe(0);

    act(() => result.current.markWorkspaceDataChanged());
    expect(result.current.workspaceDataRevision).toBe(1);
  });

  it("起動後の最初のワークスペース読込は空のcacheに対する基準activationとして扱う", () => {
    const { result, rerender } = renderHook(
      ({ workspaceId }) => useWorkspaceDataRevision(workspaceId),
      { initialProps: { workspaceId: null as string | null } }
    );

    rerender({ workspaceId: "workspace-a" });

    expect(result.current.workspaceDataRevision).toBe(0);
  });

  it("ワークスペース切替時は新しいIDと世代を同じrenderで渡し、派生データを二重取得しない", () => {
    const load = vi.fn();
    const { rerender } = renderHook(
      ({ workspaceId }) => {
        const { workspaceDataRevision } = useWorkspaceDataRevision(workspaceId);
        useEffect(() => {
          load(workspaceId, workspaceDataRevision);
        }, [workspaceDataRevision, workspaceId]);
      },
      { initialProps: { workspaceId: "workspace-a" as string | null } }
    );

    rerender({ workspaceId: "workspace-b" });

    expect(load.mock.calls).toEqual([
      ["workspace-a", 0],
      ["workspace-b", 1]
    ]);
  });
});
