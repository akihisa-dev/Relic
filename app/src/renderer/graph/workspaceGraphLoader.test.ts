import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import {
  loadWorkspaceGraph,
  preloadWorkspaceGraph,
  resetWorkspaceGraphCache
} from "./workspaceGraphLoader";

afterEach(() => {
  resetWorkspaceGraphCache();
  vi.clearAllMocks();
});

describe("workspaceGraphLoader", () => {
  it("同じワークスペース世代の先読みと同時取得を一度にまとめ、成功結果を再利用する", async () => {
    let resolveGraph!: (value: Awaited<ReturnType<NonNullable<typeof window.relic>["getWorkspaceGraph"]>>) => void;
    const pending = new Promise<Awaited<ReturnType<NonNullable<typeof window.relic>["getWorkspaceGraph"]>>>((resolve) => {
      resolveGraph = resolve;
    });
    const getWorkspaceGraph = vi.fn().mockReturnValue(pending);
    window.relic = makeRelicApi({ getWorkspaceGraph });
    const request = { revision: 0, workspaceId: "workspace-1" };

    preloadWorkspaceGraph(request);
    const graphRequest = loadWorkspaceGraph(request);
    const sphereRequest = loadWorkspaceGraph(request);
    expect(graphRequest).toBe(sphereRequest);
    expect(getWorkspaceGraph).toHaveBeenCalledOnce();

    resolveGraph({ ok: true, value: { links: [], nodes: [] } });
    await expect(graphRequest).resolves.toMatchObject({ ok: true });
    await expect(loadWorkspaceGraph(request)).resolves.toMatchObject({ ok: true });
    expect(getWorkspaceGraph).toHaveBeenCalledOnce();
  });

  it("更新番号とワークスペースの変更時は別のグラフを取得する", async () => {
    const getWorkspaceGraph = vi.fn().mockResolvedValue({ ok: true, value: { links: [], nodes: [] } });
    window.relic = makeRelicApi({ getWorkspaceGraph });

    await loadWorkspaceGraph({ revision: 0, workspaceId: "workspace-1" });
    await loadWorkspaceGraph({ revision: 1, workspaceId: "workspace-1" });
    await loadWorkspaceGraph({ revision: 1, workspaceId: "workspace-2" });

    expect(getWorkspaceGraph).toHaveBeenCalledTimes(3);
  });

  it("取得失敗を保持せず同じ世代を再試行できる", async () => {
    const getWorkspaceGraph = vi.fn()
      .mockResolvedValueOnce({ error: "failed", ok: false })
      .mockRejectedValueOnce(new Error("transport failed"))
      .mockResolvedValueOnce({ ok: true, value: { links: [], nodes: [] } });
    window.relic = makeRelicApi({ getWorkspaceGraph });
    const request = { revision: 0, workspaceId: "workspace-1" };

    await expect(loadWorkspaceGraph(request)).resolves.toMatchObject({ ok: false });
    await expect(loadWorkspaceGraph(request)).rejects.toThrow("transport failed");
    await expect(loadWorkspaceGraph(request)).resolves.toMatchObject({ ok: true });
    expect(getWorkspaceGraph).toHaveBeenCalledTimes(3);
  });

  it("古い世代を上限付きで破棄する", async () => {
    const getWorkspaceGraph = vi.fn().mockResolvedValue({ ok: true, value: { links: [], nodes: [] } });
    window.relic = makeRelicApi({ getWorkspaceGraph });

    await loadWorkspaceGraph({ revision: 0, workspaceId: "workspace-1" });
    await loadWorkspaceGraph({ revision: 1, workspaceId: "workspace-1" });
    await loadWorkspaceGraph({ revision: 2, workspaceId: "workspace-1" });
    await loadWorkspaceGraph({ revision: 0, workspaceId: "workspace-1" });

    expect(getWorkspaceGraph).toHaveBeenCalledTimes(4);
  });

  it("保持上限を超える同時取得でも同じ世代の進行中処理を共有する", () => {
    const getWorkspaceGraph = vi.fn().mockReturnValue(new Promise(() => undefined));
    window.relic = makeRelicApi({ getWorkspaceGraph });
    const oldestRequest = { revision: 0, workspaceId: "workspace-1" };

    const oldestPromise = loadWorkspaceGraph(oldestRequest);
    loadWorkspaceGraph({ revision: 1, workspaceId: "workspace-1" });
    loadWorkspaceGraph({ revision: 2, workspaceId: "workspace-1" });

    expect(loadWorkspaceGraph(oldestRequest)).toBe(oldestPromise);
    expect(getWorkspaceGraph).toHaveBeenCalledTimes(3);
  });
});
