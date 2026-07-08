import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import { ToolsPanel } from "./ToolsPanel";

function renderToolsPanel(language: "en" | "ja" = "en", workspacePath: string | null = "/tmp/notes") {
  return render(
    <I18nProvider language={language}>
      <ToolsPanel workspacePath={workspacePath} />
    </I18nProvider>
  );
}

describe("ToolsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("ワークスペースがない場合はツールを実行しない", () => {
    const generateTitleList = vi.fn();
    window.relic = makeRelicApi({ generateTitleList });

    renderToolsPanel("en", null);

    expect(screen.getByText("Open a workspace first.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create Title List/ })).not.toBeInTheDocument();
    expect(generateTitleList).not.toHaveBeenCalled();
  });

  it("入力欄を出さずにタイトル一覧と目次を既定値で生成できる", async () => {
    const generateTitleList = vi.fn().mockResolvedValue({ ok: true, value: "Title List.md" });
    const generateTableOfContents = vi.fn().mockResolvedValue({ ok: true, value: "Toc.md" });
    window.relic = makeRelicApi({ generateTableOfContents, generateTitleList });

    renderToolsPanel("en");

    expect(screen.getByText("Entire workspace")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create Title List/ }));

    await waitFor(() => {
      expect(generateTitleList).toHaveBeenCalledWith({
        filterFolder: undefined,
        outputFolder: "",
        outputName: "Title List",
        sortBy: "name"
      });
    });
    expect(await screen.findByText("Done: Title List.md")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create Table of Contents/ }));

    await waitFor(() => {
      expect(generateTableOfContents).toHaveBeenCalledWith({
        includeSubfolders: true,
        outputFolder: "",
        outputName: "Table of Contents",
        targetFolder: ""
      });
    });
  });

  it("タグ別索引を既定値で生成できる", async () => {
    const generateTagIndex = vi.fn().mockResolvedValue({ ok: true, value: "Tags.md" });
    window.relic = makeRelicApi({ generateTagIndex });

    renderToolsPanel("ja");

    fireEvent.click(screen.getByRole("button", { name: /タグ別索引を作成/ }));

    await waitFor(() => {
      expect(generateTagIndex).toHaveBeenCalledWith({
        includeSubfolders: true,
        includeUntagged: false,
        outputFolder: "",
        outputName: "タグ別索引",
        sortBy: "name",
        targetFolder: ""
      });
    });
  });

  it("フォルダ内マージを既定値で生成できる", async () => {
    const mergeFiles = vi.fn().mockResolvedValue({ ok: true, value: "merged.md" });
    window.relic = makeRelicApi({ mergeFiles });

    renderToolsPanel("ja");

    fireEvent.click(screen.getByRole("button", { name: /フォルダ内マージを作成/ }));

    await waitFor(() => {
      expect(mergeFiles).toHaveBeenCalledWith({
        filterType: "all",
        filterValue: "",
        frontmatterField: undefined,
        insertFilenameHeading: true,
        outputFolder: "",
        outputName: "マージ結果",
        sortBy: "name"
      });
    });
  });

  it("見出し分割は通常のファイル加工ツール一覧に表示しない", () => {
    window.relic = makeRelicApi();

    renderToolsPanel("en");

    expect(screen.queryByText("Split by Heading")).not.toBeInTheDocument();
  });
});
