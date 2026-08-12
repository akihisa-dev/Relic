import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { scheduleAppChartTabPreload } from "./useAppChartTabRenderer";

interface Deferred<T> {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

describe("scheduleAppChartTabPreload", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("effectの破棄前にtimerを解除し、SphereViewの読込と先読みを開始しない", () => {
    vi.useFakeTimers();
    const loadSphereView = vi.fn().mockResolvedValue(undefined);
    const preloadGraph = vi.fn();
    const cancel = scheduleAppChartTabPreload(
      { revision: 1, workspaceId: "workspace-a" },
      loadSphereView,
      preloadGraph
    );

    cancel();
    act(() => vi.runOnlyPendingTimers());

    expect(loadSphereView).not.toHaveBeenCalled();
    expect(preloadGraph).not.toHaveBeenCalled();
  });

  it("workspace切替後に遅れて完了した旧effectから旧workspaceを先読みしない", async () => {
    vi.useFakeTimers();
    const oldSphereView = deferred<void>();
    const newSphereView = deferred<void>();
    const preloadGraph = vi.fn();
    const cancelOld = scheduleAppChartTabPreload(
      { revision: 1, workspaceId: "workspace-a" },
      () => oldSphereView.promise,
      preloadGraph
    );

    act(() => vi.runOnlyPendingTimers());
    cancelOld();

    scheduleAppChartTabPreload(
      { revision: 2, workspaceId: "workspace-b" },
      () => newSphereView.promise,
      preloadGraph
    );
    act(() => vi.runOnlyPendingTimers());

    oldSphereView.resolve(undefined);
    newSphereView.resolve(undefined);
    await act(async () => {
      await Promise.all([oldSphereView.promise, newSphereView.promise]);
    });

    expect(preloadGraph).toHaveBeenCalledOnce();
    expect(preloadGraph).toHaveBeenCalledWith({ revision: 2, workspaceId: "workspace-b" });
  });

  it("SphereViewの読込完了後に同じeffectのworkspaceだけを先読みする", async () => {
    vi.useFakeTimers();
    const sphereView = deferred<void>();
    const preloadGraph = vi.fn();
    scheduleAppChartTabPreload(
      { revision: 2, workspaceId: "workspace-b" },
      () => sphereView.promise,
      preloadGraph
    );

    act(() => vi.runOnlyPendingTimers());
    expect(preloadGraph).not.toHaveBeenCalled();

    sphereView.resolve(undefined);
    await act(async () => {
      await sphereView.promise;
    });

    expect(preloadGraph).toHaveBeenCalledOnce();
    expect(preloadGraph).toHaveBeenCalledWith({ revision: 2, workspaceId: "workspace-b" });
  });

  it("SphereViewの失敗時もunhandled rejectionを残さず先読みしない", async () => {
    vi.useFakeTimers();
    const sphereView = deferred<void>();
    const preloadGraph = vi.fn();
    scheduleAppChartTabPreload(
      { revision: 1, workspaceId: "workspace-a" },
      () => sphereView.promise,
      preloadGraph
    );

    act(() => vi.runOnlyPendingTimers());
    sphereView.reject(new Error("module unavailable"));
    await expect(sphereView.promise).rejects.toThrow("module unavailable");

    expect(preloadGraph).not.toHaveBeenCalled();
  });
});
