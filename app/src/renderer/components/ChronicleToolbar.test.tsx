import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { ChronicleToolbar, type ChronicleToolbarProps } from "./ChronicleToolbar";

function renderToolbar(overrides: Partial<ChronicleToolbarProps> = {}) {
  const props: ChronicleToolbarProps = {
    activeSource: "chronicle",
    query: "",
    refreshRowOrder: vi.fn(),
    scrollToToday: vi.fn(),
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
  it("chronicle sourceではsearch/sortと並び順更新を表示しない", () => {
    const { container } = renderToolbar();

    expect(container.querySelector(".chronicle-toolbar")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-source-buttons")).toBeNull();
    expect(screen.queryByRole("button", { name: "chronicle" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "date" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("ファイル名・パス・値")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("開始順（昇順）")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "並び順を更新" })).not.toBeInTheDocument();
    expect(container.querySelector(".chronicle-actions")).toBeNull();
  });

  it("date sourceではsearch/sortを既存classと文言で描画しcallbackへつなぐ", () => {
    const { props } = renderToolbar({ activeSource: "date" });

    fireEvent.change(screen.getByPlaceholderText("ファイル名・パス・値"), { target: { value: "鎌倉" } });
    fireEvent.change(screen.getByDisplayValue("開始順（昇順）"), { target: { value: "name-desc" } });
    fireEvent.click(screen.getByRole("button", { name: "並び順を更新" }));

    expect(props.setQuery).toHaveBeenCalledWith("鎌倉");
    expect(props.setSortKey).toHaveBeenCalledWith("name-desc");
    expect(props.refreshRowOrder).toHaveBeenCalledTimes(1);
  });

  it("date sourceではstatus filterと今日buttonを表示する", () => {
    const { props } = renderToolbar({
      activeSource: "date"
    });

    fireEvent.change(screen.getByLabelText("ステータス"), { target: { value: "完了" } });
    fireEvent.click(screen.getByRole("button", { name: "今日" }));

    expect(props.setStatusFilter).toHaveBeenCalledWith("完了");
    expect(props.scrollToToday).toHaveBeenCalledTimes(1);
  });
});
