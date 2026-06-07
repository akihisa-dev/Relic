import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function sectionBlock(heading: string): HTMLElement {
  const headingElement = screen.getAllByText(heading).find((element) =>
    element.classList.contains("links-panel-subheading")
  );
  expect(headingElement).toBeInstanceOf(HTMLElement);
  const block = headingElement?.nextElementSibling;
  expect(block).toBeInstanceOf(HTMLElement);
  return block as HTMLElement;
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
    expect(generateTitleList).not.toHaveBeenCalled();
  });

  it("タイトル一覧と目次を生成できる", async () => {
    const generateTitleList = vi.fn().mockResolvedValue({ ok: true, value: "Title List.md" });
    const generateTableOfContents = vi.fn().mockResolvedValue({ ok: true, value: "Toc.md" });
    window.relic = makeRelicApi({ generateTableOfContents, generateTitleList });

    renderToolsPanel("en");

    const titleList = sectionBlock("Title List");
    fireEvent.change(within(titleList).getByLabelText("Folder"), { target: { value: "Drafts" } });
    fireEvent.change(within(titleList).getByLabelText("Sort"), { target: { value: "mtime" } });
    fireEvent.change(within(titleList).getByLabelText("Output folder"), { target: { value: "Indexes" } });
    fireEvent.change(within(titleList).getByLabelText("File name"), { target: { value: "Titles" } });
    fireEvent.click(within(titleList).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(generateTitleList).toHaveBeenCalledWith({
        filterFolder: "Drafts",
        outputFolder: "Indexes",
        outputName: "Titles",
        sortBy: "mtime"
      });
    });
    expect(await screen.findByText("Done: Title List.md")).toBeInTheDocument();

    const toc = sectionBlock("Table of Contents");
    fireEvent.change(within(toc).getByLabelText("Folder"), { target: { value: "Docs" } });
    fireEvent.click(within(toc).getByLabelText("Include subfolders"));
    fireEvent.change(within(toc).getByLabelText("Output folder"), { target: { value: "Indexes" } });
    fireEvent.change(within(toc).getByLabelText("File name"), { target: { value: "Contents" } });
    fireEvent.click(within(toc).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(generateTableOfContents).toHaveBeenCalledWith({
        includeSubfolders: false,
        outputFolder: "Indexes",
        outputName: "Contents",
        targetFolder: "Docs"
      });
    });
  });

  it("フロントマター条件を指定してマージできる", async () => {
    const mergeFiles = vi.fn().mockResolvedValue({ ok: true, value: "merged.md" });
    window.relic = makeRelicApi({ mergeFiles });

    renderToolsPanel("ja");

    fireEvent.change(screen.getByLabelText("フィルター"), { target: { value: "frontmatter" } });
    fireEvent.change(screen.getByLabelText("フロントマターフィールド"), { target: { value: "status" } });
    fireEvent.change(screen.getByLabelText("フロントマター値"), { target: { value: "draft" } });
    fireEvent.click(screen.getByRole("button", { name: "フォルダ内マージ" }));

    await waitFor(() => {
      expect(mergeFiles).toHaveBeenCalledWith(expect.objectContaining({
        filterType: "frontmatter",
        filterValue: "draft",
        frontmatterField: "status"
      }));
    });
  });

  it("見出し分割は通常のファイル加工ツール一覧に表示しない", () => {
    window.relic = makeRelicApi();

    renderToolsPanel("en");

    expect(screen.queryByText("Split by Heading")).not.toBeInTheDocument();
  });
});
