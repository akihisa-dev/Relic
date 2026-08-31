import { describe, expect, it, vi } from "vitest";

import { configureApplicationQuitLifecycle } from "./applicationQuitLifecycle";

function createHarness(isImmediateQuitBypassed = false) {
  let willQuitListener: ((event: { preventDefault(): void }) => void) | null = null;
  const app = {
    on: vi.fn((_event: "will-quit", listener: typeof willQuitListener) => {
      willQuitListener = listener;
    }),
    quit: vi.fn()
  };
  const stopAcceptingRequestsAndWait = vi.fn<() => Promise<void>>(async () => undefined);
  const stopWorkspaceWatcher = vi.fn();

  configureApplicationQuitLifecycle({
    app,
    isImmediateQuitBypassed: () => isImmediateQuitBypassed,
    stopAcceptingRequestsAndWait,
    stopWorkspaceWatcher
  });

  return {
    app,
    emitWillQuit: (preventDefault = vi.fn()) => {
      if (!willQuitListener) throw new Error("will-quit listener was not registered.");
      willQuitListener({ preventDefault });
      return preventDefault;
    },
    stopAcceptingRequestsAndWait,
    stopWorkspaceWatcher
  };
}

describe("configureApplicationQuitLifecycle", () => {
  it("進行中のMain処理が完了してから監視を止め、終了を再開する", async () => {
    let releaseDrain!: () => void;
    const harness = createHarness();
    harness.stopAcceptingRequestsAndWait.mockImplementation(() => new Promise<void>((resolve) => {
      releaseDrain = resolve;
    }));

    const preventDefault = harness.emitWillQuit();
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(harness.stopWorkspaceWatcher).not.toHaveBeenCalled();
    expect(harness.app.quit).not.toHaveBeenCalled();

    releaseDrain();
    await vi.waitFor(() => expect(harness.app.quit).toHaveBeenCalledOnce());
    expect(harness.stopWorkspaceWatcher).toHaveBeenCalledOnce();

    const finalPreventDefault = harness.emitWillQuit();
    expect(finalPreventDefault).not.toHaveBeenCalled();
    expect(harness.stopAcceptingRequestsAndWait).toHaveBeenCalledOnce();
  });

  it("終了待機中にwill-quitが重なってもdrainを一度だけ開始する", () => {
    const harness = createHarness();
    harness.stopAcceptingRequestsAndWait.mockImplementation(() => new Promise<void>(() => undefined));

    const first = harness.emitWillQuit();
    const second = harness.emitWillQuit();

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(harness.stopAcceptingRequestsAndWait).toHaveBeenCalledOnce();
  });

  it("開発版と起動スモークの明示的な終了では待機せず監視だけを停止する", () => {
    const harness = createHarness(true);

    const preventDefault = harness.emitWillQuit();

    expect(preventDefault).not.toHaveBeenCalled();
    expect(harness.stopAcceptingRequestsAndWait).not.toHaveBeenCalled();
    expect(harness.stopWorkspaceWatcher).toHaveBeenCalledOnce();
  });
});
