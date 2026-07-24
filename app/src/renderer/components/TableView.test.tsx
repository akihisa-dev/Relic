import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  defaultWorkspaceTablePreferences,
  type WorkspaceTable,
  type WorkspaceTablePreferences
} from "../../shared/ipc";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import { resetWorkspaceTableCache } from "../table/workspaceTableLoader";
import { TableView } from "./TableView";

afterEach(() => {
  cleanup();
  resetWorkspaceTableCache();
  vi.clearAllMocks();
});

const table: WorkspaceTable = {
  availableProperties: ["count", "status"],
  preferences: defaultWorkspaceTablePreferences,
  rows: [
    { frontmatterStatus: "valid", name: "note2", path: "a/note2.md", properties: { count: { kind: "number", numberValue: 2, text: "2" }, status: { kind: "string", text: "draft" } } },
    { frontmatterStatus: "invalid", name: "note2", path: "b/note2.md", properties: { count: { kind: "number", numberValue: 10, text: "10" } } }
  ]
};

function preferences(overrides: Partial<WorkspaceTablePreferences> = {}): WorkspaceTablePreferences {
  return {
    ...defaultWorkspaceTablePreferences,
    ...overrides,
    columnWidths: overrides.columnWidths ?? [],
    filters: overrides.filters ?? [],
    selectedProperties: overrides.selectedProperties ?? [],
    sort: overrides.sort ?? { direction: "asc", property: null },
    wrappedProperties: overrides.wrappedProperties ?? []
  };
}

function renderTable(overrides: Partial<typeof window.relic> = {}, value: WorkspaceTable = table): void {
  window.relic = makeRelicApi({
    getWorkspaceTable: vi.fn().mockResolvedValue({ ok: true, value }),
    saveWorkspaceTablePreferences: vi.fn(async (input) => ({ ok: true as const, value: input })),
    ...overrides
  });
  render(
    <I18nProvider language="ja">
      <TableView onOpenFile={vi.fn()} refreshRevision={0} workspaceId="workspace-1" />
    </I18nProvider>
  );
}

describe("TableView", () => {
  it("ファイル名、相対フォルダ、壊れたYAMLを示してファイルを開く", async () => {
    const onOpenFile = vi.fn();
    window.relic = makeRelicApi({ getWorkspaceTable: vi.fn().mockResolvedValue({ ok: true, value: table }) });
    render(
      <I18nProvider language="ja">
        <TableView onOpenFile={onOpenFile} refreshRevision={0} workspaceId="workspace-1" />
      </I18nProvider>
    );

    expect(await screen.findByText("2件")).toBeInTheDocument();
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    expect(screen.getByLabelText(/フロントマターを読み取れません/)).toBeInTheDocument();
    const tableElement = screen.getByRole("table");
    fireEvent.scroll(tableElement, { target: { scrollTop: 24 } });
    expect(tableElement).toHaveClass("table-view-scroll--scrolled");
    fireEvent.click(screen.getAllByRole("button", { name: /^note2/ })[0]);
    expect(onOpenFile).toHaveBeenCalledWith("a/note2.md");
  });

  it("検索と複数条件の絞り込みを表示件数へ反映して保存する", async () => {
    const save = vi.fn(async (input: WorkspaceTablePreferences) => ({ ok: true as const, value: input }));
    renderTable({ saveWorkspaceTablePreferences: save }, {
      ...table,
      preferences: preferences({ selectedProperties: ["status", "count"] })
    });

    await screen.findByText("2件");
    fireEvent.change(screen.getByRole("searchbox", { name: "テーブルを検索" }), { target: { value: "note2" } });
    expect(screen.getByText("2件表示 / 全2件")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "テーブルを検索" }), { target: { value: "draft" } });
    expect(screen.getByText("1件表示 / 全2件")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
    expect(screen.queryByText("10")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "テーブルを検索" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "絞り込み" }));
    fireEvent.change(screen.getByRole("combobox", { name: "対象" }), { target: { value: "property" } });
    fireEvent.change(screen.getByRole("combobox", { name: "プロパティ" }), { target: { value: "status" } });
    fireEvent.change(screen.getByRole("combobox", { name: "条件" }), { target: { value: "missing" } });
    fireEvent.click(screen.getByRole("button", { name: "条件を追加" }));

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(screen.getByText("1件表示 / 全2件")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "絞り込み 1" })).toBeInTheDocument();
  });

  it("列選択、並び替え、幅、折り返しをキーボード操作で保存する", async () => {
    const save = vi.fn(async (input: WorkspaceTablePreferences) => ({ ok: true as const, value: input }));
    renderTable({ saveWorkspaceTablePreferences: save });

    await screen.findByText("2件");
    fireEvent.click(screen.getByRole("button", { name: "列" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "count" }));
    await waitFor(() => expect(screen.getByRole("columnheader", { name: /count/ })).toBeInTheDocument());

    const separator = screen.getByRole("separator", { name: "count列の幅を変更" });
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "count列の操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "値を折り返す" }));

    await waitFor(() => {
      const last = save.mock.calls.at(-1)?.[0];
      expect(last).toBeDefined();
      if (!last) return;
      expect(last.columnWidths).toContainEqual({ property: "count", width: 206 });
      expect(last.wrappedProperties).toEqual(["count"]);
    });
    expect(screen.getByText("2").closest(".table-view-row")).toHaveStyle({ height: "80px" });
  });

  it("列ドラッグは中断では保存せず、ドロップで表示順を保存する", async () => {
    const save = vi.fn(async (input: WorkspaceTablePreferences) => ({ ok: true as const, value: input }));
    renderTable({ saveWorkspaceTablePreferences: save }, {
      ...table,
      preferences: preferences({ selectedProperties: ["count", "status"] })
    });

    await screen.findByText("2件");
    const countHandle = screen.getByRole("button", { name: "count列を移動" });
    const statusHeader = screen.getByRole("columnheader", { name: /status/ });
    Object.defineProperty(statusHeader, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ bottom: 40, height: 40, left: 100, right: 200, top: 0, width: 100, x: 100, y: 0 })
    });
    const dataTransfer = { dropEffect: "none", effectAllowed: "none", setData: vi.fn() };

    fireEvent.dragStart(countHandle, { dataTransfer });
    fireEvent.dragOver(statusHeader, { clientX: 190, dataTransfer });
    expect(statusHeader).toHaveStyle("--table-column-drag-offset: -190px");
    expect(screen.getByText("draft").closest(".table-view-cell")).toHaveStyle("--table-column-drag-offset: -190px");
    expect(screen.getByLabelText("2").closest(".table-view-cell")).toHaveClass("table-view-cell--dragging");
    fireEvent.dragEnd(countHandle, { dataTransfer });
    expect(save).not.toHaveBeenCalled();
    expect(statusHeader).toHaveStyle("--table-column-drag-offset: 0px");
    expect(screen.getByLabelText("2").closest(".table-view-cell")).not.toHaveClass("table-view-cell--dragging");

    fireEvent.dragStart(countHandle, { dataTransfer });
    fireEvent.dragOver(statusHeader, { clientX: 190, dataTransfer });
    fireEvent.drop(statusHeader, { clientX: 190, dataTransfer });
    await waitFor(() => expect(save.mock.calls.at(-1)?.[0].selectedProperties).toEqual(["status", "count"]));
  });

  it("列順の保存に失敗した場合は確定前の順へ戻して再試行できる", async () => {
    const save = vi.fn()
      .mockResolvedValueOnce({ error: { code: "WRITE_FAILED", message: "保存できません" }, ok: false })
      .mockImplementation(async (input: WorkspaceTablePreferences) => ({ ok: true as const, value: input }));
    renderTable({ saveWorkspaceTablePreferences: save }, {
      ...table,
      preferences: preferences({ selectedProperties: ["count", "status"] })
    });

    await screen.findByText("2件");
    const countHandle = screen.getByRole("button", { name: "count列を移動" });
    const statusHeader = screen.getByRole("columnheader", { name: /status/ });
    Object.defineProperty(statusHeader, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ bottom: 40, height: 40, left: 100, right: 200, top: 0, width: 100, x: 100, y: 0 })
    });
    const dataTransfer = { dropEffect: "none", effectAllowed: "none", setData: vi.fn() };

    fireEvent.dragStart(countHandle, { dataTransfer });
    fireEvent.dragOver(statusHeader, { clientX: 190, dataTransfer });
    fireEvent.drop(statusHeader, { clientX: 190, dataTransfer });

    expect(await screen.findByRole("alert")).toHaveTextContent("保存できません");
    const headers = screen.getAllByRole("columnheader");
    expect(headers.findIndex((header) => header.textContent?.includes("count")))
      .toBeLessThan(headers.findIndex((header) => header.textContent?.includes("status")));

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1]?.[0].selectedProperties).toEqual(["status", "count"]);
  });

  it("列幅ドラッグの中断では保存せず、次の操作を確定できる", async () => {
    const save = vi.fn(async (input: WorkspaceTablePreferences) => ({ ok: true as const, value: input }));
    renderTable({ saveWorkspaceTablePreferences: save }, {
      ...table,
      preferences: preferences({ selectedProperties: ["count"] })
    });

    await screen.findByText("2件");
    const separator = screen.getByRole("separator", { name: "count列の幅を変更" });
    dispatchPointer(separator, "pointerdown", 100, 1);
    dispatchPointer(separator, "pointermove", 160, 1);
    dispatchPointer(separator, "pointercancel", 160, 1);
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("columnheader", { name: /count/ }).parentElement).toHaveStyle({ gridTemplateColumns: "260px 190px" });

    dispatchPointer(separator, "pointerdown", 100, 2);
    dispatchPointer(separator, "pointermove", 140, 2);
    dispatchPointer(separator, "pointerup", 140, 2);
    await waitFor(() => expect(save.mock.calls.at(-1)?.[0].columnWidths).toContainEqual({ property: "count", width: 230 }));
  });

  it("Escapeでポップオーバーを閉じて開いたボタンへフォーカスを戻す", async () => {
    renderTable();
    await screen.findByText("2件");
    const trigger = screen.getByRole("button", { name: "絞り込み" });
    fireEvent.click(trigger);
    const target = screen.getByRole("combobox", { name: "対象" });
    target.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "絞り込み" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("保存失敗を表示し、現在の表示設定で再試行する", async () => {
    const save = vi.fn()
      .mockResolvedValueOnce({ error: { code: "WRITE_FAILED", message: "保存できません" }, ok: false })
      .mockImplementation(async (input: WorkspaceTablePreferences) => ({ ok: true as const, value: input }));
    renderTable({ saveWorkspaceTablePreferences: save });

    await screen.findByText("2件");
    fireEvent.click(screen.getByRole("button", { name: "列" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "count" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("保存できません");
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  });

  it("連続保存では古い失敗を後の成功へ反映しない", async () => {
    const pending: Array<{
      input: WorkspaceTablePreferences;
      resolve: (result:
        | { error: { code: string; message: string }; ok: false }
        | { ok: true; value: WorkspaceTablePreferences }) => void;
    }> = [];
    const save = vi.fn((input: WorkspaceTablePreferences) => new Promise<
      | { error: { code: string; message: string }; ok: false }
      | { ok: true; value: WorkspaceTablePreferences }
    >((resolve) => pending.push({ input, resolve })));
    renderTable({ saveWorkspaceTablePreferences: save });

    await screen.findByText("2件");
    fireEvent.click(screen.getByRole("button", { name: "列" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "count" }));
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.click(screen.getByRole("checkbox", { name: "status" }));
    await waitFor(() => expect(pending).toHaveLength(2));

    pending[1]!.resolve({ ok: true, value: pending[1]!.input });
    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: /count/ })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /status/ })).toBeInTheDocument();
    });
    pending[0]!.resolve({
      error: { code: "WRITE_FAILED", message: "古い失敗" },
      ok: false
    });

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("columnheader", { name: /count/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /status/ })).toBeInTheDocument();
  });

  it("固定プロパティ設定と大量行の仮想化を維持する", async () => {
    const largeTable: WorkspaceTable = {
      availableProperties: ["category"],
      preferences: preferences({ selectedProperties: ["category"] }),
      rows: Array.from({ length: 1000 }, (_, index) => ({
        frontmatterStatus: "valid" as const,
        name: `note${index}`,
        path: `note${index}.md`,
        properties: { category: { kind: "string" as const, text: index === 0 ? "War" : "Archive" } }
      }))
    };
    renderTable({}, largeTable);

    await screen.findByText("1000件");
    expect(document.querySelectorAll(".table-view-row").length).toBeLessThan(30);
    fireEvent.click(screen.getByRole("button", { name: "categoryの設定" }));
    expect(screen.getByRole("dialog", { name: "categoryの設定" })).toBeInTheDocument();
  });
});

function dispatchPointer(element: Element, type: string, clientX: number, pointerId: number): void {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: clientX },
    pointerId: { value: pointerId }
  });
  fireEvent(element, event);
}
