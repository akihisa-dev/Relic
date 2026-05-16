import { act, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useGraphFloatingPanelPosition } from "./useGraphFloatingPanelPosition";

function rect({ height, left, top, width }: { height: number; left: number; top: number; width: number }): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    toJSON: () => ({}),
    top,
    width,
    x: left,
    y: top
  } as DOMRect;
}

function attachPanel(): HTMLDivElement {
  const container = document.createElement("div");
  const panel = document.createElement("div");
  document.body.appendChild(container);
  container.appendChild(panel);

  vi.spyOn(container, "getBoundingClientRect").mockReturnValue(rect({ height: 300, left: 10, top: 20, width: 420 }));
  vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(rect({ height: 120, left: 50, top: 70, width: 140 }));

  return panel;
}

function makePointerEvent(overrides: Partial<{
  button: number;
  clientX: number;
  clientY: number;
  preventDefault: () => void;
  stopPropagation: () => void;
}> = {}): ReactPointerEvent<HTMLElement> {
  return {
    button: 0,
    clientX: 70,
    clientY: 95,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides
  } as unknown as ReactPointerEvent<HTMLElement>;
}

describe("useGraphFloatingPanelPosition", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("初期状態ではstyleがundefined", () => {
    const { result } = renderHook(() => useGraphFloatingPanelPosition());

    expect(result.current.style).toBeUndefined();
  });

  it("左クリックdrag開始で初期位置styleを設定しeventを抑止する", () => {
    const { result } = renderHook(() => useGraphFloatingPanelPosition());
    const panel = attachPanel();
    (result.current.panelRef as { current: HTMLDivElement | null }).current = panel;
    const event = makePointerEvent();

    act(() => {
      result.current.onPointerDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(result.current.style).toEqual({
      left: 40,
      right: "auto",
      top: 50,
      transform: "none"
    });
  });

  it("pointermoveで位置を更新しcontainer内のmarginにclampする", () => {
    const { result } = renderHook(() => useGraphFloatingPanelPosition());
    const panel = attachPanel();
    (result.current.panelRef as { current: HTMLDivElement | null }).current = panel;

    act(() => {
      result.current.onPointerDown(makePointerEvent());
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 1000, clientY: -1000 }));
    });

    expect(result.current.style).toEqual({
      left: 272,
      right: "auto",
      top: 8,
      transform: "none"
    });
  });

  it("非左クリックでは位置変更とevent抑止を行わない", () => {
    const { result } = renderHook(() => useGraphFloatingPanelPosition());
    const panel = attachPanel();
    (result.current.panelRef as { current: HTMLDivElement | null }).current = panel;
    const event = makePointerEvent({ button: 1 });

    act(() => {
      result.current.onPointerDown(event);
    });

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(result.current.style).toBeUndefined();
  });
});
