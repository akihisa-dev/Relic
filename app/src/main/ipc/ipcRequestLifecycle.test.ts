import { describe, expect, it, vi } from "vitest";

import { IpcRequestLifecycle } from "./ipcRequestLifecycle";

describe("IpcRequestLifecycle", () => {
  it("終了待機の開始前に受け付けた処理だけを完了まで待つ", async () => {
    const lifecycle = new IpcRequestLifecycle();
    let resolveRequest!: (value: string) => void;
    const request = lifecycle.runIfAccepting(() => new Promise<string>((resolve) => {
      resolveRequest = resolve;
    }));
    const drained = vi.fn();
    const drain = lifecycle.stopAcceptingAndWait().then(drained);

    await Promise.resolve();
    expect(drained).not.toHaveBeenCalled();
    await expect(lifecycle.runIfAccepting(() => "late")).resolves.toEqual({
      accepted: false
    });

    resolveRequest("saved");
    await expect(request).resolves.toEqual({ accepted: true, value: "saved" });
    await drain;
    expect(drained).toHaveBeenCalledOnce();
  });

  it("失敗した処理も完了として扱い、次の終了待機を止めない", async () => {
    const lifecycle = new IpcRequestLifecycle();
    const request = lifecycle.runIfAccepting(() => {
      throw new Error("write failed");
    });

    await expect(request).rejects.toThrow("write failed");
    await expect(lifecycle.stopAcceptingAndWait()).resolves.toBeUndefined();
  });
});
