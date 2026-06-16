import { describe, expect, it, vi } from "vitest";

import { startWindowPointerDrag } from "./windowPointerDrag";

function makePointerDown(element: HTMLElement, pointerId = 1): never {
  element.setPointerCapture = vi.fn();
  element.hasPointerCapture = vi.fn().mockReturnValue(true);
  element.releasePointerCapture = vi.fn();

  return {
    currentTarget: element,
    pointerId,
    preventDefault: vi.fn()
  } as never;
}

describe("startWindowPointerDrag", () => {
  it("pointerupでlistenerを解除しpointer captureを解放する", () => {
    const element = document.createElement("div");
    const move = vi.fn();
    const up = vi.fn();

    startWindowPointerDrag({
      event: makePointerDown(element, 4),
      onMove: move,
      onUp: up
    });

    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 10 }));
    window.dispatchEvent(new MouseEvent("pointerup", { clientX: 20 }));
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 30 }));

    expect(move).toHaveBeenCalledTimes(1);
    expect(up).toHaveBeenCalledTimes(1);
    expect(element.setPointerCapture).toHaveBeenCalledWith(4);
    expect(element.releasePointerCapture).toHaveBeenCalledWith(4);
  });

  it("pointercancelでcancel処理を呼び、以後のmoveを無視する", () => {
    const element = document.createElement("div");
    const move = vi.fn();
    const cancel = vi.fn();

    startWindowPointerDrag({
      event: makePointerDown(element),
      onCancel: cancel,
      onMove: move
    });

    window.dispatchEvent(new MouseEvent("pointercancel"));
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 10 }));

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(move).not.toHaveBeenCalled();
    expect(element.releasePointerCapture).toHaveBeenCalledWith(1);
  });
});
