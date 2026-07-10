import { afterEach, describe, expect, it, vi } from "vitest";

import { createGraphSimulationClient } from "./graphSimulationClient";

class MockWorker {
  static instances: MockWorker[] = [];

  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    MockWorker.instances.push(this);
  }
}

describe("createGraphSimulationClient", () => {
  afterEach(() => {
    MockWorker.instances = [];
    vi.unstubAllGlobals();
  });

  it("Workerは一度だけ終了し、終了後の通知や要求を無視する", () => {
    vi.stubGlobal("Worker", MockWorker);
    const onPositions = vi.fn();
    const onError = vi.fn();
    const client = createGraphSimulationClient(onPositions, onError);
    const worker = MockWorker.instances[0];

    client.dispose();
    client.dispose();
    client.restart();
    worker.onmessage?.({ data: { buffer: new ArrayBuffer(0), ids: [], type: "positions" } } as MessageEvent);
    worker.onerror?.({ message: "late error" } as ErrorEvent);

    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "dispose" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(onPositions).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("終了メッセージの送信に失敗してもWorkerを終了する", () => {
    vi.stubGlobal("Worker", MockWorker);
    const client = createGraphSimulationClient(vi.fn());
    const worker = MockWorker.instances[0];
    worker.postMessage.mockImplementation(() => {
      throw new Error("post failed");
    });

    expect(() => client.dispose()).toThrow("post failed");
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
