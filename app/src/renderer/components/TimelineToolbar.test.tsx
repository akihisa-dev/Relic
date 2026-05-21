import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CardbookTimelineChart } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { TimelineToolbar, type TimelineToolbarProps } from "./TimelineToolbar";

function chart(overrides: Partial<CardbookTimelineChart> = {}): CardbookTimelineChart {
  return {
    entries: [],
    id: "timeline",
    name: "timeline",
    source: "timeline",
    ...overrides
  };
}

function renderToolbar(overrides: Partial<TimelineToolbarProps> = {}) {
  const timelineChart = chart();
  const props: TimelineToolbarProps = {
    activeChart: timelineChart,
    activeSource: "timeline",
    availableCharts: [timelineChart],
    query: "",
    refreshRowOrder: vi.fn(),
    scrollToToday: vi.fn(),
    selectChart: vi.fn(),
    setQuery: vi.fn(),
    setSortKey: vi.fn(),
    setStatusFilter: vi.fn(),
    sortKey: "start-asc",
    statusFilter: "",
    statusOptions: ["未着手", "完了"],
    ...overrides
  };

  return {
    props,
    ...render(
      <I18nProvider language="ja">
        <TimelineToolbar {...props} />
      </I18nProvider>
    )
  };
}

describe("TimelineToolbar", () => {
  it("source/search/sortを既存classと文言で描画しcallbackへつなぐ", () => {
    const { container, props } = renderToolbar();

    expect(container.querySelector(".timeline-toolbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "年表" })).toHaveClass("active");
    fireEvent.change(screen.getByPlaceholderText("カード名・パス・値"), { target: { value: "鎌倉" } });
    fireEvent.change(screen.getByDisplayValue("開始順（昇順）"), { target: { value: "name-desc" } });
    fireEvent.click(screen.getByRole("button", { name: "並び順を更新" }));

    expect(props.setQuery).toHaveBeenCalledWith("鎌倉");
    expect(props.setSortKey).toHaveBeenCalledWith("name-desc");
    expect(props.refreshRowOrder).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".timeline-actions")).toBeNull();
  });
});
