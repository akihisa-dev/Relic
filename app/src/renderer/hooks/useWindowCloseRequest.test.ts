import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WindowCloseRequestEvent } from "../../shared/ipc";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { useWindowCloseRequest } from "./useWindowCloseRequest";

describe("useWindowCloseRequest", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("ウィンドウのクローズ要求へ保存確認結果を返す", async () => {
    let closeRequestHandler: (event: WindowCloseRequestEvent) => void = () => {
      throw new Error("close request handler was not registered");
    };
    const respondToWindowCloseRequest = vi.fn();
    window.relic = makeRelicApi({
      onWindowCloseRequested: vi.fn((callback) => {
        closeRequestHandler = callback;
        return vi.fn();
      }),
      respondToWindowCloseRequest
    });

    renderHook(() => useWindowCloseRequest(() => Promise.resolve(true)));

    closeRequestHandler({ requestId: "close-1" });

    await waitFor(() => {
      expect(respondToWindowCloseRequest).toHaveBeenCalledWith({ ok: true, requestId: "close-1" });
    });
  });

  it("保存確認中の例外では閉じない応答を返す", async () => {
    let closeRequestHandler: (event: WindowCloseRequestEvent) => void = () => {
      throw new Error("close request handler was not registered");
    };
    const respondToWindowCloseRequest = vi.fn();
    window.relic = makeRelicApi({
      onWindowCloseRequested: vi.fn((callback) => {
        closeRequestHandler = callback;
        return vi.fn();
      }),
      respondToWindowCloseRequest
    });

    renderHook(() => useWindowCloseRequest(() => Promise.reject(new Error("save failed"))));

    closeRequestHandler({ requestId: "close-2" });

    await waitFor(() => {
      expect(respondToWindowCloseRequest).toHaveBeenCalledWith({ ok: false, requestId: "close-2" });
    });
  });
});
