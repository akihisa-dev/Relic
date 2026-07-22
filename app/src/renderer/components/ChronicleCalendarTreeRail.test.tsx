import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { ChronicleCalendarTreeRail } from "./ChronicleCalendarTreeRail";

afterEach(cleanup);

const nodes = [{
  calendarName: "基準暦",
  categories: [
    { count: 1, hue: 20, key: "category:地誌", label: "地誌", visibilityKey: "base-place" },
    { count: 1, hue: 137, key: "category:戦役", label: "戦役", visibilityKey: "base-war" }
  ],
  hue: null
}, {
  calendarName: "灰王暦",
  categories: [{ count: 2, hue: 137, key: "category:戦役", label: "戦役", visibilityKey: "ash-war" }],
  hue: 137
}];
const globalCategories = [
  { count: 1, hue: 20, key: "category:地誌", label: "地誌" },
  { count: 3, hue: 137, key: "category:戦役", label: "戦役" }
];

function renderRail(overrides: Partial<Parameters<typeof ChronicleCalendarTreeRail>[0]> = {}) {
  const props = {
    baseCalendarName: "基準暦",
    collapsed: false,
    globalCategories,
    hiddenCategoryKeys: new Set<string>(),
    nodes,
    onCalendarVisibilityChange: vi.fn(),
    onCategoryVisibilityChange: vi.fn(),
    onCollapsedChange: vi.fn(),
    onGlobalCategoryVisibilityChange: vi.fn(),
    visibleCalendarNames: new Set(["基準暦", "灰王暦"]),
    ...overrides
  };
  render(<I18nProvider language="ja"><ChronicleCalendarTreeRail {...props} /></I18nProvider>);
  return props;
}

describe("ChronicleCalendarTreeRail", () => {
  it("暦から所属カテゴリをたどり、それぞれの表示を切り替える", () => {
    const props = renderRail();
    const grayCalendarButton = screen.getByRole("button", { name: "灰王暦を折りたたむ" });
    const grayCalendarGroup = grayCalendarButton.closest("section");
    expect(grayCalendarGroup).not.toBeNull();
    fireEvent.click(within(grayCalendarGroup as HTMLElement).getByRole("button", { name: "戦役カテゴリを非表示" }));
    expect(props.onCategoryVisibilityChange).toHaveBeenCalledWith("ash-war", false);
    fireEvent.click(screen.getByRole("button", { name: "灰王暦を非表示" }));
    expect(props.onCalendarVisibilityChange).toHaveBeenCalledWith("灰王暦", false);

    fireEvent.click(screen.getByRole("button", { name: "灰王暦を折りたたむ" }));
    expect(within(grayCalendarGroup as HTMLElement).queryByRole("button", { name: "戦役カテゴリを非表示" })).not.toBeInTheDocument();
  });

  it("年表全体の同名カテゴリを全暦横断で切り替える", () => {
    const props = renderRail();
    fireEvent.click(screen.getByRole("button", { name: "全暦の戦役カテゴリを非表示" }));
    expect(props.onGlobalCategoryVisibilityChange).toHaveBeenCalledWith("category:戦役", false);
  });

  it("一部の暦だけ非表示なら中間状態から全暦を再表示する", () => {
    const props = renderRail({ hiddenCategoryKeys: new Set(["base-war"]) });
    const button = screen.getByRole("button", { name: "全暦の戦役カテゴリを表示" });
    expect(button).toHaveAttribute("aria-pressed", "mixed");
    fireEvent.click(button);
    expect(props.onGlobalCategoryVisibilityChange).toHaveBeenCalledWith("category:戦役", true);
  });

  it("暦名とカテゴリ名を検索し、Escapeで解除する", () => {
    renderRail();
    const search = screen.getByRole("searchbox", { name: "暦・カテゴリを検索" });
    fireEvent.change(search, { target: { value: "戦役" } });
    expect(screen.queryByText("地誌")).not.toBeInTheDocument();
    expect(screen.getAllByText("戦役")).toHaveLength(3);
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.getAllByText("地誌")).toHaveLength(2);
  });
});
