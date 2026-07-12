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
});
