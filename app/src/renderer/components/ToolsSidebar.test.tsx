import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import { ToolsSidebar } from "./ToolsSidebar";

function renderToolsSidebar(language: "en" | "ja" = "en", workspacePath: string | null = "/tmp/notes") {
  return render(
    <I18nProvider language={language}>
      <ToolsSidebar workspacePath={workspacePath} />
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

describe("ToolsSidebar", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("カードブックがない場合はツールを実行しない", () => {
    const generateTitleList = vi.fn();
    window.relic = makeRelicApi({ generateTitleList });

    renderToolsSidebar("en", null);

    expect(screen.getByText("Open a cardbook first.")).toBeInTheDocument();
    expect(generateTitleList).not.toHaveBeenCalled();
  });

  it("タイトル一覧と目次を生成できる", async () => {
    const generateTitleList = vi.fn().mockResolvedValue({ ok: true, value: "Title List.md" });
    const generateTableOfContents = vi.fn().mockResolvedValue({ ok: true, value: "Toc.md" });
    window.relic = makeRelicApi({ generateTableOfContents, generateTitleList });

    renderToolsSidebar("en");

    const titleList = sectionBlock("Title List");
    fireEvent.change(within(titleList).getByLabelText("Card folder"), { target: { value: "Drafts" } });
    fireEvent.change(within(titleList).getByLabelText("Sort"), { target: { value: "mtime" } });
    fireEvent.change(within(titleList).getByLabelText("Output card folder"), { target: { value: "Indexes" } });
    fireEvent.change(within(titleList).getByLabelText("Card name"), { target: { value: "Titles" } });
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
    fireEvent.change(within(toc).getByLabelText("Card folder"), { target: { value: "Docs" } });
    fireEvent.click(within(toc).getByLabelText("Include card folders"));
    fireEvent.change(within(toc).getByLabelText("Output card folder"), { target: { value: "Indexes" } });
    fireEvent.change(within(toc).getByLabelText("Card name"), { target: { value: "Contents" } });
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

  it("プロパティ条件を指定してマージできる", async () => {
    const mergeFiles = vi.fn().mockResolvedValue({ ok: true, value: "merged.md" });
    window.relic = makeRelicApi({ mergeFiles });

    renderToolsSidebar("ja");

    fireEvent.change(screen.getByLabelText("フィルター"), { target: { value: "frontmatter" } });
    fireEvent.change(screen.getByLabelText("プロパティフィールド"), { target: { value: "status" } });
    fireEvent.change(screen.getByLabelText("プロパティ値"), { target: { value: "draft" } });
    fireEvent.click(screen.getByRole("button", { name: "条件指定マージ" }));

    await waitFor(() => {
      expect(mergeFiles).toHaveBeenCalledWith(expect.objectContaining({
        filterType: "frontmatter",
        filterValue: "draft",
        frontmatterField: "status"
      }));
    });
  });

  it("ソース指定時だけ見出し分割を実行する", async () => {
    const splitFileByHeading = vi.fn().mockResolvedValue({ ok: true, value: ["A.md", "B.md"] });
    window.relic = makeRelicApi({ splitFileByHeading });

    renderToolsSidebar("en");

    const split = sectionBlock("Split by Heading");
    fireEvent.click(within(split).getByRole("button", { name: "Split by Heading" }));
    expect(splitFileByHeading).not.toHaveBeenCalled();

    fireEvent.change(within(split).getByLabelText("Source card"), { target: { value: "Book.md" } });
    fireEvent.change(within(split).getByLabelText("Heading level"), { target: { value: "3" } });
    fireEvent.change(within(split).getByLabelText("Output card folder"), { target: { value: "Chapters" } });
    fireEvent.click(within(split).getByRole("button", { name: "Split by Heading" }));

    await waitFor(() => {
      expect(splitFileByHeading).toHaveBeenCalledWith({
        headingLevel: 3,
        outputFolder: "Chapters",
        sourcePath: "Book.md"
      });
    });
    expect(await screen.findByText("Done: 2 card(s) created")).toBeInTheDocument();
  });
});
