import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceGanttChart } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { ChronicleToolbar, type ChronicleToolbarProps } from "./ChronicleToolbar";

function chart(overrides: Partial<WorkspaceGanttChart> = {}): WorkspaceGanttChart {
  return {
    entries: [],
    id: "chronicle",
    name: "chronicle",
    source: "chronicle",
    ...overrides
  };
}

function renderToolbar(overrides: Partial<ChronicleToolbarProps> = {}) {
  const chronicleChart = chart();
  const props: ChronicleToolbarProps = {
    activeChart: chronicleChart,
    activeSource: "chronicle",
    availableCharts: [chronicleChart],
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
        <ChronicleToolbar {...props} />
      </I18nProvider>
    )
  };
}

describe("ChronicleToolbar", () => {
  it("source/search/sortを既存classと文言で描画しcallbackへつなぐ", () => {
    const { container, props } = renderToolbar();

    expect(container.querySelector(".chronicle-toolbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "chronicle" })).toHaveClass("active");
    fireEvent.change(screen.getByPlaceholderText("カード名・パス・値"), { target: { value: "鎌倉" } });
    fireEvent.change(screen.getByDisplayValue("開始順（昇順）"), { target: { value: "name-desc" } });
    fireEvent.click(screen.getByRole("button", { name: "並び順を更新" }));

    expect(props.setQuery).toHaveBeenCalledWith("鎌倉");
    expect(props.setSortKey).toHaveBeenCalledWith("name-desc");
    expect(props.refreshRowOrder).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".chronicle-actions")).toBeNull();
  });
});
