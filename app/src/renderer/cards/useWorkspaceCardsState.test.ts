import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceCard } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { resetWorkspaceCardsCache } from "./workspaceCardsLoader";
import { useWorkspaceCardsState } from "./useWorkspaceCardsState";

describe("useWorkspaceCardsState", () => {
  afterEach(() => {
    resetWorkspaceCardsCache();
    window.relic = undefined;
    vi.clearAllMocks();
  });

  it("ワークスペース切替直後に旧カードを隠し、現在の一覧だけを返す", async () => {
    const first = deferred<RelicResult<WorkspaceCard[]>>();
    const second = deferred<RelicResult<WorkspaceCard[]>>();
    window.relic = makeRelicApi({
      getWorkspaceCards: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    });

    const { result, rerender } = renderHook(
      ({ workspaceId }) => useWorkspaceCardsState({
        loadFailedMessage: "読み込めません",
        refreshRevision: 0,
        workspaceId
      }),
      { initialProps: { workspaceId: "workspace-a" } }
    );

    await act(async () => first.resolve({ ok: true, value: [card("A.md")] }));
    expect(result.current).toMatchObject({ status: "ready", cards: [card("A.md")] });

    rerender({ workspaceId: "workspace-b" });
    expect(result.current).toEqual({ status: "loading" });

    await act(async () => second.resolve({ ok: true, value: [card("B.md")] }));
    expect(result.current).toMatchObject({ status: "ready", cards: [card("B.md")] });
  });
});

function card(path: string): WorkspaceCard {
  return { flavorText: null, imagePath: "image.webp", name: path, path };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
