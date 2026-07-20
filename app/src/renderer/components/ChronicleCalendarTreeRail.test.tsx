import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { ChronicleCalendarTreeRail } from "./ChronicleCalendarTreeRail";

afterEach(cleanup);

const nodes = [{
  calendarName: "基準暦",
  categories: [{ count: 1, hue: 20, key: "category:地誌", label: "地誌", visibilityKey: "base-place" }],
  hue: null
}, {
  calendarName: "灰王暦",
  categories: [{ count: 2, hue: 137, key: "category:戦役", label: "戦役", visibilityKey: "ash-war" }],
  hue: 137
}];

function renderRail(overrides: Partial<Parameters<typeof ChronicleCalendarTreeRail>[0]> = {}) {
  const props = {
    baseCalendarName: "基準暦",
    collapsed: false,
    hiddenCategoryKeys: new Set<string>(),
    nodes,
    onCalendarVisibilityChange: vi.fn(),
    onCategoryVisibilityChange: vi.fn(),
    onCollapsedChange: vi.fn(),
    visibleCalendarNames: new Set(["基準暦", "灰王暦"]),
    ...overrides
  };
  render(<I18nProvider language="ja"><ChronicleCalendarTreeRail {...props} /></I18nProvider>);
  return props;
}

describe("ChronicleCalendarTreeRail", () => {
  it("暦から所属カテゴリをたどり、それぞれの表示を切り替える", () => {
    const props = renderRail();
    fireEvent.click(screen.getByRole("button", { name: "戦役カテゴリを非表示" }));
    expect(props.onCategoryVisibilityChange).toHaveBeenCalledWith("ash-war", false);
    fireEvent.click(screen.getByRole("button", { name: "灰王暦を非表示" }));
    expect(props.onCalendarVisibilityChange).toHaveBeenCalledWith("灰王暦", false);

    fireEvent.click(screen.getByRole("button", { name: "灰王暦を折りたたむ" }));
    expect(screen.queryByRole("button", { name: "戦役カテゴリを非表示" })).not.toBeInTheDocument();
  });

  it("暦名とカテゴリ名を検索し、Escapeで解除する", () => {
    renderRail();
    const search = screen.getByRole("searchbox", { name: "暦・カテゴリを検索" });
    fireEvent.change(search, { target: { value: "戦役" } });
    expect(screen.queryByText("地誌")).not.toBeInTheDocument();
    expect(screen.getByText("戦役")).toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.getByText("地誌")).toBeInTheDocument();
  });
});
