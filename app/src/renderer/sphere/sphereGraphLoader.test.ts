import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import {
  loadSphereWorkspaceGraph,
  preloadSphereWorkspaceGraph,
  resetSphereWorkspaceGraphCache
} from "./sphereGraphLoader";

afterEach(() => {
  resetSphereWorkspaceGraphCache();
  vi.clearAllMocks();
});

describe("sphereGraphLoader", () => {
  it("同じワークスペース世代の取得を再利用する", async () => {
    const getWorkspaceGraph = vi.fn().mockResolvedValue({ ok: true, value: { links: [], nodes: [] } });
    window.relic = makeRelicApi({ getWorkspaceGraph });

    preloadSphereWorkspaceGraph("workspace-1:0");
    await expect(loadSphereWorkspaceGraph("workspace-1:0")).resolves.toMatchObject({ ok: true });
    expect(getWorkspaceGraph).toHaveBeenCalledOnce();

    await loadSphereWorkspaceGraph("workspace-1:1");
    expect(getWorkspaceGraph).toHaveBeenCalledTimes(2);
  });

  it("取得失敗は保持せず次の表示で再試行する", async () => {
    const getWorkspaceGraph = vi.fn()
      .mockResolvedValueOnce({ error: "failed", ok: false })
      .mockResolvedValueOnce({ ok: true, value: { links: [], nodes: [] } });
    window.relic = makeRelicApi({ getWorkspaceGraph });

    await expect(loadSphereWorkspaceGraph("workspace-1:0")).resolves.toMatchObject({ ok: false });
    await expect(loadSphereWorkspaceGraph("workspace-1:0")).resolves.toMatchObject({ ok: true });
    expect(getWorkspaceGraph).toHaveBeenCalledTimes(2);
  });
});
