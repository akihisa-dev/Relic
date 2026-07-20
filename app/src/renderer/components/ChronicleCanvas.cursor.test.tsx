import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { ChronicleCanvas } from "./ChronicleCanvas";

afterEach(() => {
  cleanup();
});

describe("ChronicleCanvas cursor", () => {
  it("暦設定を現在のツールバー内で開き、追加暦面の表示を切り替える", () => {
    const onSave = vi.fn();
    render(
      <I18nProvider language="ja">
        <ChronicleCanvas
          calendarSettings={{
            baseCalendarName: "基準暦",
            calendars: [{ name: "別暦", range: null, yearOne: 450 }],
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
    expect(screen.getByRole("checkbox", { name: "基準暦" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "別暦" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ visibleCalendarNames: ["基準暦", "別暦"] }));
  });

  it("暦面の終了年だけを入力し、追加暦の1年から始まる範囲として保存する", () => {
    const onSave = vi.fn();
    render(
      <I18nProvider language="ja">
        <ChronicleCanvas
          calendarSettings={{
            baseCalendarName: "基準暦",
            calendars: [{ name: "別暦", range: null, yearOne: 450 }],
            visibleCalendarNames: ["基準暦", "別暦"]
          }}
          entries={[]}
          onCalendarSettingsSave={onSave}
          onOpenFile={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "暦設定" }));
    expect(screen.getByText(/終了年未設定/)).toBeInTheDocument();
    expect(screen.queryByLabelText("暦面の開始年")).not.toBeInTheDocument();
    const end = screen.getByLabelText("暦面の終了年");
    fireEvent.change(end, { target: { value: "0" } });
    fireEvent.blur(end);
    expect(screen.getByText("終了年を1以上の整数で入力してください。")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(end, { target: { value: "100" } });
    fireEvent.blur(end);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      calendars: [{ name: "別暦", range: { end: 100, start: 1 }, yearOne: 450 }]
    }));
  });

  it("暦面の設定範囲外にある項目件数を表示する", () => {
    render(
      <I18nProvider language="ja">
        <ChronicleCanvas
          calendarSettings={{
            baseCalendarName: "基準暦",
            calendars: [{ name: "別暦", range: { end: 5, start: 1 }, yearOne: 100 }],
            visibleCalendarNames: ["基準暦", "別暦"]
          }}
          entries={[{
            calendarName: "別暦",
            chronicleEntryIndex: 0,
            endLabel: "11",
            endPoint: { month: null, year: 110 },
            endValue: 110,
            fileName: "Outside",
            path: "outside.md",
            startLabel: "11",
            startPoint: { month: null, year: 110 },
            startValue: 110
          }]}
          onOpenFile={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "暦設定" }));
    expect(screen.getByText("設定範囲外に1件の項目があります。")).toBeInTheDocument();
  });

  it("非表示の追加暦面しか項目がない場合はカテゴリ非表示と区別する", () => {
    render(
      <I18nProvider language="ja">
        <ChronicleCanvas
          calendarSettings={{
            baseCalendarName: "基準暦",
            calendars: [{ name: "別暦", range: { end: 20, start: 1 }, yearOne: 100 }],
            visibleCalendarNames: ["基準暦"]
          }}
          entries={[{
            calendarName: "別暦",
            chronicleEntryIndex: 0,
            endLabel: "1",
            endPoint: { month: null, year: 100 },
            endValue: 100,
            fileName: "Hidden surface item",
            path: "hidden.md",
            startLabel: "1",
            startPoint: { month: null, year: 100 },
            startValue: 100
          }]}
          onOpenFile={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText("表示中の暦面に年表項目はありません。")).toBeInTheDocument();
    expect(screen.queryByText("すべてのカテゴリが非表示です。")).not.toBeInTheDocument();
  });

  it("暦設定はパネル内の操作では維持し、外側のクリックで閉じる", () => {
    render(
      <I18nProvider language="ja">
        <ChronicleCanvas entries={[]} onOpenFile={vi.fn()} />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "暦設定" }));
    const panel = screen.getByRole("region", { name: "暦設定" });
    fireEvent.pointerDown(panel);
    expect(panel).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("region", { name: "暦設定" })).not.toBeInTheDocument();

    const settingsButton = screen.getByRole("button", { name: "暦設定" });
    fireEvent.click(settingsButton);
    fireEvent.pointerDown(settingsButton);
    fireEvent.click(settingsButton);
    expect(screen.queryByRole("region", { name: "暦設定" })).not.toBeInTheDocument();
  });

  it("その他の暦の開始年を空欄から負数まで入力して保存する", () => {
    const onSave = vi.fn();
    render(
      <I18nProvider language="ja">
        <ChronicleCanvas
          calendarSettings={{
            baseCalendarName: "基準暦",
            calendars: [{ name: "別暦", range: null, yearOne: 450 }],
            visibleCalendarNames: ["基準暦"]
          }}
          entries={[]}
          onCalendarSettingsSave={onSave}
          onOpenFile={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "暦設定" }));
    const yearOneInput = screen.getByLabelText(/1年 ＝ 基準暦/);
    fireEvent.change(yearOneInput, { target: { value: "" } });
    expect(yearOneInput).toHaveValue("");
    fireEvent.change(yearOneInput, { target: { value: "-" } });
    expect(yearOneInput).toHaveValue("-");
    fireEvent.change(yearOneInput, { target: { value: "-240" } });
    fireEvent.blur(yearOneInput);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      calendars: [{ name: "別暦", range: null, yearOne: -240 }]
    }));
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
    fireEvent(canvas, new MouseEvent("lostpointercapture", { bubbles: true, clientX: 12, clientY: 12 }));
    expect(canvas).toHaveStyle("cursor: grab");
  });
});
