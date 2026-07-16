import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { loadWorkspaceCards, resetWorkspaceCardsCache } from "./workspaceCardsLoader";

afterEach(() => {
  resetWorkspaceCardsCache();
  vi.clearAllMocks();
});

describe("workspaceCardsLoader", () => {
  it("同じワークスペース世代のカード索引を再利用する", async () => {
    const getWorkspaceCards = vi.fn().mockResolvedValue({ ok: true, value: [] });
    window.relic = makeRelicApi({ getWorkspaceCards });
    const request = { revision: 0, workspaceId: "workspace-1" };

    await loadWorkspaceCards(request);
    await loadWorkspaceCards(request);

    expect(getWorkspaceCards).toHaveBeenCalledOnce();
  });

  it("更新番号またはワークスペースが変わると再取得する", async () => {
    const getWorkspaceCards = vi.fn().mockResolvedValue({ ok: true, value: [] });
    window.relic = makeRelicApi({ getWorkspaceCards });

    await loadWorkspaceCards({ revision: 0, workspaceId: "workspace-1" });
    await loadWorkspaceCards({ revision: 1, workspaceId: "workspace-1" });
    await loadWorkspaceCards({ revision: 1, workspaceId: "workspace-2" });

    expect(getWorkspaceCards).toHaveBeenCalledTimes(3);
  });
});
