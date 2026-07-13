import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { ChronicleCanvas } from "./ChronicleCanvas";

afterEach(() => {
  cleanup();
});

describe("ChronicleCanvas cursor", () => {
  it("年表を押している間はgrabbingカーソルを表示する", () => {
    render(
      <I18nProvider language="en">
        <ChronicleCanvas entries={[]} onOpenFile={vi.fn()} />
      </I18nProvider>
    );

    const canvas = screen.getByLabelText("Timeline");
    Object.defineProperty(canvas, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(canvas, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(canvas, "releasePointerCapture", { configurable: true, value: vi.fn() });

    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 0, clientY: 0 }));
    expect(canvas).toHaveStyle("cursor: grabbing");

    fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 0, clientY: 0 }));
    expect(canvas).toHaveStyle("cursor: grab");
  });

  it("pointercancelでは操作を確定せず、次の操作を開始できる", () => {
    const onOpenFile = vi.fn();
    render(
      <I18nProvider language="en">
        <ChronicleCanvas entries={[]} onOpenFile={onOpenFile} />
      </I18nProvider>
    );

    const canvas = screen.getByLabelText("Timeline");
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperty(canvas, "setPointerCapture", { configurable: true, value: setPointerCapture });
    Object.defineProperty(canvas, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(canvas, "releasePointerCapture", { configurable: true, value: releasePointerCapture });

    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    fireEvent(canvas, new MouseEvent("pointermove", { bubbles: true, clientX: 30, clientY: 20 }));
    fireEvent(canvas, new MouseEvent("pointercancel", { bubbles: true, clientX: 30, clientY: 20 }));

    expect(releasePointerCapture).toHaveBeenCalledOnce();
    expect(canvas).toHaveStyle("cursor: grab");
    expect(onOpenFile).not.toHaveBeenCalled();

    fireEvent(canvas, new MouseEvent("pointerup", { bubbles: true, clientX: 30, clientY: 20 }));
    expect(onOpenFile).not.toHaveBeenCalled();
    fireEvent(canvas, new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 12, clientY: 12 }));
    expect(setPointerCapture).toHaveBeenCalledTimes(2);
    expect(canvas).toHaveStyle("cursor: grabbing");
  });
});
