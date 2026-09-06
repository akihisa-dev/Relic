import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RelicResult } from "../../shared/result";
import { useWorkspaceResourceController } from "./useWorkspaceResourceState";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

const ready = (value: string): RelicResult<string> => ({ ok: true, value });

describe("workspace resource requests", () => {
  it("同じワークスペースの更新中は表示を保ち、切替直後と戻った直後に以前の表示を出さない", async () => {
    const pending = deferred<RelicResult<string>>();
    const loadResource = vi.fn().mockResolvedValueOnce(ready("first")).mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(({ workspaceId, revision }) => useWorkspaceResourceController({
      workspaceId, revision, loadResource, retainWhileRefreshing: true, loadFailedMessage: "failed"
    }), { initialProps: { workspaceId: "a", revision: 0 } });
    await act(async () => undefined);
    expect(result.current.state).toEqual({ status: "ready", value: "first" });
    rerender({ workspaceId: "a", revision: 1 });
    expect(result.current.state).toEqual({ status: "ready", value: "first" });
    rerender({ workspaceId: "b", revision: 1 });
    expect(result.current.state.status).toBe("loading");
    rerender({ workspaceId: "a", revision: 1 });
    expect(result.current.state.status).toBe("loading");
  });

  it("重なる再取得は最新だけを反映し、古い失敗を通知せず、失敗後も再試行できる", async () => {
    const first = deferred<RelicResult<string>>();
    const second = deferred<RelicResult<string>>();
    const loadResource = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
      .mockRejectedValueOnce(new Error("private detail")).mockResolvedValueOnce(ready("retry"));
    const onError = vi.fn();
    const { result } = renderHook(() => useWorkspaceResourceController({
      workspaceId: "a", revision: 0, loadResource, onError, loadFailedMessage: "failed"
    }));
    let reload!: Promise<boolean>;
    act(() => { reload = result.current.reload(); });
    await act(async () => { second.resolve(ready("latest")); expect(await reload).toBe(true); });
    await act(async () => first.resolve({ ok: false, error: { code: "OLD", message: "old failure" } }));
    expect(result.current.state).toEqual({ status: "ready", value: "latest" });
    expect(onError).not.toHaveBeenCalled();
    await act(async () => { expect(await result.current.reload()).toBe(false); });
    expect(result.current.state).toEqual({ status: "error", message: "failed" });
    expect(onError).toHaveBeenCalledExactlyOnceWith("failed");
    await act(async () => { expect(await result.current.reload()).toBe(true); });
    expect(result.current.state).toEqual({ status: "ready", value: "retry" });
  });

  it("ファイル一覧更新で再取得し、切替前のreloadは新しい要求を発行しない", async () => {
    const loadResource = vi.fn().mockResolvedValue(ready("value"));
    const { result, rerender } = renderHook(({ workspaceId, refreshToken }) => useWorkspaceResourceController({
      workspaceId, refreshToken, revision: 0, loadResource, loadFailedMessage: "failed"
    }), { initialProps: { workspaceId: "a", refreshToken: [] as string[] } });
    await act(async () => undefined);
    const oldReload = result.current.reload;
    rerender({ workspaceId: "a", refreshToken: ["new.md"] });
    await act(async () => undefined);
    expect(loadResource).toHaveBeenCalledTimes(2);
    rerender({ workspaceId: "b", refreshToken: [] });
    await act(async () => undefined);
    expect(await oldReload()).toBe(false);
    expect(loadResource).toHaveBeenCalledTimes(3);
  });
});
