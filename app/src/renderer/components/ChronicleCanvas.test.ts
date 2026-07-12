import { afterEach, describe, expect, it, vi } from "vitest";

import { cancelChronicleCanvasFrame, chronicleCanvasWheelFactor } from "../chronicleCanvasHelpers";

describe("cancelChronicleCanvasFrame", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("取り消した描画予約を未予約状態へ戻す", () => {
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    const frameRef = { current: 42 as number | null };

    cancelChronicleCanvasFrame(frameRef);

    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(frameRef.current).toBeNull();
  });

  it("描画予約がなければ何もしない", () => {
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    cancelChronicleCanvasFrame({ current: null });

    expect(cancelAnimationFrame).not.toHaveBeenCalled();
  });
});

describe("chronicleCanvasWheelFactor", () => {
  it("上方向のホイールで拡大し、下方向で縮小する", () => {
    expect(chronicleCanvasWheelFactor(-100)).toBeGreaterThan(1);
    expect(chronicleCanvasWheelFactor(100)).toBeLessThan(1);
    expect(chronicleCanvasWheelFactor(0)).toBe(1);
  });
});
