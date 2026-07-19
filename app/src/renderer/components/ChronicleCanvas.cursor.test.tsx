import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { ChronicleCanvas } from "./ChronicleCanvas";

afterEach(() => {
  cleanup();
});

describe("ChronicleCanvas cursor", () => {
  it("暦設定を現在のツールバー内で開き、表示する暦を複数選択する", () => {
    const onSave = vi.fn();
    render(
      <I18nProvider language="ja">
        <ChronicleCanvas
          calendarSettings={{
            baseCalendarName: "基準暦",
            calendars: [{ name: "別暦", yearOne: 450 }],
            visibleCalendarNames: ["基準暦"]
          }}
          entries={[]}
          onCalendarSettingsSave={onSave}
          onOpenFile={vi.fn()}
        />
      </I18nProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "暦設定" }));
    expect(screen.getByRole("heading", { name: "暦設定" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "別暦" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ visibleCalendarNames: ["基準暦", "別暦"] }));
  });

  it("ズーム操作とは独立した期間スケールを段階的に変更する", () => {
    render(
      <I18nProvider language="en">
        <ChronicleCanvas entries={[]} onOpenFile={vi.fn()} />
      </I18nProvider>
    );

    const slider = screen.getByRole("slider", { name: "Period scale" });
    const scaleValue = screen.getByText("10-year intervals");
    const settingsButton = screen.getByRole("button", { name: "Calendar settings" });
    expect(slider).toHaveAttribute("aria-valuetext", "10-year intervals");
    expect(slider.parentElement).toContainElement(scaleValue);
    expect(slider.closest(".chronicle-period-scale")?.lastElementChild).toBe(settingsButton);

    fireEvent.change(slider, { target: { value: "4" } });

    expect(slider).toHaveValue("4");
    expect(slider).toHaveAttribute("aria-valuetext", "100-year intervals");
    expect(screen.getByText("100-year intervals")).toBeInTheDocument();
  });

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
