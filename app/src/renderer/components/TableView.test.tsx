import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceTable } from "../../shared/ipc";
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
  rows: [
    { frontmatterStatus: "valid", name: "note2", path: "a/note2.md", properties: { count: { kind: "number", numberValue: 2, text: "2" }, status: { kind: "string", text: "draft" } } },
    { frontmatterStatus: "invalid", name: "note2", path: "b/note2.md", properties: { count: { kind: "number", numberValue: 10, text: "10" } } }
  ],
  selectedProperties: []
};

function renderTable(onOpenFile = vi.fn()): void {
  render(
    <I18nProvider language="ja">
      <TableView onOpenFile={onOpenFile} refreshRevision={0} workspaceId="workspace-1" />
    </I18nProvider>
  );
}

describe("TableView", () => {
  it("初回はファイル名だけを表示し、同名の相対フォルダと壊れたYAMLを示してファイルを開く", async () => {
    const onOpenFile = vi.fn();
    window.relic = makeRelicApi({ getWorkspaceTable: vi.fn().mockResolvedValue({ ok: true, value: table }) });
    renderTable(onOpenFile);

    expect(await screen.findByText("2件のファイル")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(1);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    const warning = screen.getByLabelText(/フロントマターを読み取れません/);
    expect(warning).toBeInTheDocument();
    expect(warning).not.toHaveAttribute("data-full-value");
    expect(warning).not.toHaveAttribute("tabindex");
    expect(warning).not.toHaveClass("table-value-tooltip");

    const fileButtons = screen.getAllByRole("button", { name: /^note2/ });
    fireEvent.click(fileButtons[0]);
    expect(onOpenFile).toHaveBeenCalledWith("a/note2.md");
    fireEvent.keyDown(fileButtons[1], { key: "Enter" });
    fireEvent.click(fileButtons[1]);
    expect(onOpenFile).toHaveBeenCalledWith("b/note2.md");
  });

  it("プロパティを検索して選び、列設定を保存して単一列で並べ替える", async () => {
    const saveWorkspaceTableProperties = vi.fn().mockResolvedValue({ ok: true, value: ["count"] });
    window.relic = makeRelicApi({
      getWorkspaceTable: vi.fn().mockResolvedValue({ ok: true, value: table }),
      saveWorkspaceTableProperties
    });
    renderTable();

    await screen.findByText("2件のファイル");
    fireEvent.click(screen.getByRole("button", { name: "列" }));
    expect(screen.queryByText("固定プロパティ")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "プロパティを検索" }), { target: { value: "cou" } });
    expect(screen.queryByText("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "count" }));
    await waitFor(() => expect(saveWorkspaceTableProperties).toHaveBeenCalledWith(["count"]));
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "countで並べ替え" }));
    expect(screen.getByRole("columnheader", { name: /count/ })).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(screen.getByRole("button", { name: "countで並べ替え" }));
    expect(screen.getByRole("columnheader", { name: /count/ })).toHaveAttribute("aria-sort", "descending");

    const tableElement = screen.getByRole("table");
    expect(tableElement).toHaveClass("table-view-scroll");
    expect(tableElement.querySelectorAll(".table-view-cell--sticky").length).toBeGreaterThan(1);
    const tableHeader = tableElement.querySelector<HTMLElement>(".table-view-header");
    expect(tableHeader?.style.gridTemplateColumns).toBe("260px repeat(1, 190px)");
    expect(tableHeader?.style.minWidth).toBe("450px");
  });

  it("プロパティ列のドラッグ中断では保存せず、ドロップ時だけ順序を保存する", async () => {
    const saveWorkspaceTableProperties = vi.fn().mockResolvedValue({ ok: true, value: ["status", "count"] });
    window.relic = makeRelicApi({
      getWorkspaceTable: vi.fn().mockResolvedValue({
        ok: true,
        value: { ...table, selectedProperties: ["count", "status"] }
      }),
      saveWorkspaceTableProperties
    });
    renderTable();

    await screen.findByText("2件のファイル");
    const countHandle = screen.getByRole("button", { name: "count列を移動" });
    const statusHeader = screen.getByRole("columnheader", { name: /status/ });
    Object.defineProperty(statusHeader, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ bottom: 40, height: 40, left: 100, right: 200, top: 0, width: 100, x: 100, y: 0 })
    });
    const dataTransfer = { dropEffect: "none", effectAllowed: "none", setData: vi.fn() };

    fireEvent.dragStart(countHandle, { dataTransfer });
    fireEvent.dragEnd(countHandle, { dataTransfer });
    expect(saveWorkspaceTableProperties).not.toHaveBeenCalled();

    fireEvent.dragStart(countHandle, { dataTransfer });
    fireEvent.dragOver(statusHeader, { clientX: 190, dataTransfer });
    expect(statusHeader).toHaveClass("table-view-cell--drop-after");
    fireEvent.drop(statusHeader, { clientX: 190, dataTransfer });

    await waitFor(() => expect(saveWorkspaceTableProperties).toHaveBeenCalledWith(["status", "count"]));
    const headers = screen.getAllByRole("columnheader");
    expect(headers[1].querySelector(".table-sort-button")).toHaveTextContent("status");
    expect(headers[2].querySelector(".table-sort-button")).toHaveTextContent("count");
  });

  it("列の並び順保存に失敗した場合は元の順序へ戻す", async () => {
    const saveWorkspaceTableProperties = vi.fn().mockResolvedValue({
      error: { code: "WRITE_FAILED", message: "列設定を保存できませんでした。" },
      ok: false
    });
    window.relic = makeRelicApi({
      getWorkspaceTable: vi.fn().mockResolvedValue({
        ok: true,
        value: { ...table, selectedProperties: ["count", "status"] }
      }),
      saveWorkspaceTableProperties
    });
    renderTable();

    await screen.findByText("2件のファイル");
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

    expect(await screen.findByRole("alert")).toHaveTextContent("列設定を保存できませんでした。");
    const headers = screen.getAllByRole("columnheader");
    expect(headers[1].querySelector(".table-sort-button")).toHaveTextContent("count");
    expect(headers[2].querySelector(".table-sort-button")).toHaveTextContent("status");
  });

  it("固定プロパティの列から説明とcategory候補を管理する", async () => {
    const onCategoryChoicesSave = vi.fn();
    const categoryTable: WorkspaceTable = {
      ...table,
      availableProperties: ["category"],
      selectedProperties: ["category"],
      rows: table.rows.map((row, index) => ({
        ...row,
        properties: {
          category: { kind: "string", text: index === 0 ? "War" : "Politics" }
        }
      }))
    };
    window.relic = makeRelicApi({
      getWorkspaceTable: vi.fn().mockResolvedValue({ ok: true, value: categoryTable })
    });
    render(
      <I18nProvider language="en">
        <TableView
          categoryChoices={["War"]}
          onCategoryChoicesSave={onCategoryChoicesSave}
          onOpenFile={vi.fn()}
          refreshRevision={0}
          workspaceId="workspace-1"
        />
      </I18nProvider>
    );

    await screen.findByText("2 files");
    const valueCell = screen.getByText("War");
    expect(valueCell).not.toHaveAttribute("title");
    expect(valueCell).not.toHaveAttribute("data-full-value");
    expect(valueCell).not.toHaveAttribute("tabindex");
    expect(valueCell).not.toHaveClass("table-value-tooltip");
    fireEvent.click(screen.getByRole("button", { name: "category settings" }));

    expect(screen.getByRole("dialog", { name: "category settings" })).toBeInTheDocument();
    expect(screen.getByText("Fixed")).toBeInTheDocument();
    expect(screen.getByText("A single value used to classify a file. Choose from workspace category choices or keep an existing value.")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Enter a choice" }), { target: { value: "Archive" } });
    fireEvent.click(screen.getByRole("button", { name: "Add choice" }));
    expect(onCategoryChoicesSave).toHaveBeenCalledWith(["War", "Archive"]);

    fireEvent.click(screen.getByRole("button", { name: "YAML writing guide" }));
    expect(screen.getByText("category: War")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "category settings" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    expect(screen.queryByRole("button", { name: "Open aliases reference" })).not.toBeInTheDocument();
  });

  it("更新番号が変わると再取得し、表示列と並べ替え条件を維持する", async () => {
    const updatedTable: WorkspaceTable = {
      ...table,
      rows: [...table.rows, {
        frontmatterStatus: "valid",
        name: "note3",
        path: "note3.md",
        properties: { count: { kind: "number", numberValue: 3, text: "3" } }
      }],
      selectedProperties: ["count"]
    };
    const getWorkspaceTable = vi.fn()
      .mockResolvedValueOnce({ ok: true, value: { ...table, selectedProperties: ["count"] } })
      .mockResolvedValueOnce({ ok: true, value: updatedTable });
    window.relic = makeRelicApi({ getWorkspaceTable });
    const view = render(
      <I18nProvider language="ja">
        <TableView onOpenFile={vi.fn()} refreshRevision={0} workspaceId="workspace-1" />
      </I18nProvider>
    );

    await screen.findByText("2件のファイル");
    fireEvent.click(screen.getByRole("button", { name: "countで並べ替え" }));
    fireEvent.click(screen.getByRole("button", { name: "countで並べ替え" }));
    view.rerender(
      <I18nProvider language="ja">
        <TableView onOpenFile={vi.fn()} refreshRevision={1} workspaceId="workspace-1" />
      </I18nProvider>
    );

    expect(await screen.findByText("3件のファイル")).toBeInTheDocument();
    expect(getWorkspaceTable).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("columnheader", { name: /count/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("大量行では表示範囲の行だけをDOMへ作る", async () => {
    const largeTable: WorkspaceTable = {
      availableProperties: [],
      rows: Array.from({ length: 1000 }, (_, index) => ({
        frontmatterStatus: "none" as const,
        name: `note${index}`,
        path: `note${index}.md`,
        properties: {}
      })),
      selectedProperties: []
    };
    window.relic = makeRelicApi({ getWorkspaceTable: vi.fn().mockResolvedValue({ ok: true, value: largeTable }) });
    const view = render(
      <I18nProvider language="ja">
        <TableView onOpenFile={vi.fn()} refreshRevision={0} workspaceId="workspace-1" />
      </I18nProvider>
    );

    await screen.findByText("1000件のファイル");
    expect(view.container.querySelectorAll(".table-view-row").length).toBeLessThan(30);
    expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "1001");
  });

  it("空状態と読込失敗をビュー内で案内する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceTable: vi.fn().mockResolvedValueOnce({
        ok: true,
        value: { availableProperties: [], rows: [], selectedProperties: [] }
      })
    });
    renderTable();
    expect(await screen.findByText("表示できるMarkdownファイルがありません")).toBeInTheDocument();

    cleanup();
    resetWorkspaceTableCache();
    window.relic = makeRelicApi({
      getWorkspaceTable: vi.fn().mockResolvedValue({
        error: { code: "FAILED", message: "テーブルを取得できません" },
        ok: false
      })
    });
    renderTable();
    expect(await screen.findByText("テーブルを取得できません")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });
});
