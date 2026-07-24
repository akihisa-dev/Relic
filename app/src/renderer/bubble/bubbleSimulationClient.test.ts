import { afterEach, describe, expect, it, vi } from "vitest";

import { createBubbleSimulationClient } from "./bubbleSimulationClient";
import { bubbleSimulationVelocityDecay } from "./bubbleTypes";

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

describe("createBubbleSimulationClient", () => {
  afterEach(() => {
    MockWorker.instances = [];
    vi.unstubAllGlobals();
  });

  it("移動速度を毎回強く減衰させて長い滑走を防ぐ", () => {
    expect(bubbleSimulationVelocityDecay).toBe(0.68);
  });

  it("ノード位置とドラッグ中の物理演算状態をWorkerへ通知する", () => {
    vi.stubGlobal("Worker", MockWorker);
    const client = createBubbleSimulationClient(vi.fn());
    const worker = MockWorker.instances[0]!;

    client.setInteractionActive(true);
    client.moveNode("A.md", 12, 24);
    client.setNodeCategoryCenterOffset("A.md", -24, 8);
    client.setNodeFixed("A.md", null, null, 0.08, 4, -2);

    expect(worker.postMessage).toHaveBeenCalledWith({
      active: true,
      alpha: undefined,
      type: "interaction"
    });
    expect(worker.postMessage).toHaveBeenCalledWith({
      alpha: undefined,
      id: "A.md",
      type: "moveNode",
      x: 12,
      y: 24
    });
    expect(worker.postMessage).toHaveBeenCalledWith({
      id: "A.md",
      offsetX: -24,
      offsetY: 8,
      type: "categoryCenterOffset"
    });
    expect(worker.postMessage).toHaveBeenCalledWith({
      alpha: 0.08,
      id: "A.md",
      type: "fixedNode",
      velocityX: 4,
      velocityY: -2,
      x: null,
      y: null
    });
  });

  it("Workerは一度だけ終了し、終了後の通知や要求を無視する", () => {
    vi.stubGlobal("Worker", MockWorker);
    const onPositions = vi.fn();
    const onError = vi.fn();
    const client = createBubbleSimulationClient(onPositions, onError);
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
    const client = createBubbleSimulationClient(vi.fn());
    const worker = MockWorker.instances[0];
    worker.postMessage.mockImplementation(() => {
      throw new Error("post failed");
    });

    expect(() => client.dispose()).toThrow("post failed");
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
