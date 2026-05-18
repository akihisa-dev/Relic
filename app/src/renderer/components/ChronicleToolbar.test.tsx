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
  const dateChart = chart({ id: "date", name: "date", source: "date" });
  const props: ChronicleToolbarProps = {
    activeChart: chronicleChart,
    activeSource: "chronicle",
    availableCharts: [chronicleChart, dateChart],
    query: "",
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
    fireEvent.click(screen.getByRole("button", { name: "date" }));
    fireEvent.change(screen.getByPlaceholderText("ファイル名・パス・値"), { target: { value: "鎌倉" } });
    fireEvent.change(screen.getByDisplayValue("開始順（昇順）"), { target: { value: "name-desc" } });

    expect(props.selectChart).toHaveBeenCalledWith(expect.objectContaining({ id: "date" }));
    expect(props.setQuery).toHaveBeenCalledWith("鎌倉");
    expect(props.setSortKey).toHaveBeenCalledWith("name-desc");
    expect(container.querySelector(".chronicle-actions")).toBeNull();
  });

  it("date sourceではstatus filterと今日buttonを表示する", () => {
    const { props } = renderToolbar({
      activeChart: chart({ id: "date", name: "date", source: "date" }),
      activeSource: "date"
    });

    fireEvent.change(screen.getByLabelText("ステータス"), { target: { value: "完了" } });
    fireEvent.click(screen.getByRole("button", { name: "今日" }));

    expect(props.setStatusFilter).toHaveBeenCalledWith("完了");
    expect(props.scrollToToday).toHaveBeenCalledTimes(1);
  });
});
