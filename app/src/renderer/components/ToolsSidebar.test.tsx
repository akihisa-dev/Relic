import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultFeatureToggles } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { ToolsSidebar } from "./ToolsSidebar";

function makeRelicApi(overrides: Partial<typeof window.relic> = {}): typeof window.relic {
  return {
    applySearchAndReplace: vi.fn(),
    createFolder: vi.fn(),
    createLinkedMarkdownFile: vi.fn(),
    createMarkdownFile: vi.fn(),
    createNewWorkspace: vi.fn(),
    duplicateMarkdownFile: vi.fn(),
    generateTableOfContents: vi.fn(),
    generateTitleList: vi.fn(),
    getAppInfo: vi.fn(),
    getBacklinks: vi.fn(),
    getEditorSettings: vi.fn(),
    getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: defaultFeatureToggles }),
    getFrontmatterTemplates: vi.fn(),
    getFrontmatterValueCandidates: vi.fn(),
    getUserDefinedFields: vi.fn(),
    getWorkspaceState: vi.fn(),
    getWorkspaceTags: vi.fn(),
    mergeFiles: vi.fn().mockResolvedValue({ ok: true, value: "merged.md" }),
    moveFolder: vi.fn(),
    moveItemToTrash: vi.fn(),
    moveMarkdownFile: vi.fn(),
    openWorkspace: vi.fn(),
    readClipboardText: vi.fn().mockReturnValue(""),
    readMarkdownFile: vi.fn(),
    removeWorkspace: vi.fn(),
    renameFolder: vi.fn(),
    renameMarkdownFile: vi.fn(),
    replaceInFile: vi.fn(),
    revealWorkspaceItem: vi.fn(),
    saveEditorSettings: vi.fn(),
    saveFeatureToggles: vi.fn(),
    saveFrontmatterTemplates: vi.fn(),
    saveWorkspaceGanttCharts: vi.fn(),
    saveUserDefinedFields: vi.fn(),
    searchAndReplace: vi.fn(),
    searchWorkspace: vi.fn(),
    splitFileByHeading: vi.fn(),
    switchWorkspace: vi.fn(),
    togglePin: vi.fn(),
    updateGanttChartEntry: vi.fn(),
    writeClipboardText: vi.fn(),
    writeMarkdownFile: vi.fn(),
    ...overrides
  } as typeof window.relic;
}

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

  it("ワークスペースがない場合はツールを実行しない", () => {
    const generateTitleList = vi.fn();
    window.relic = makeRelicApi({ generateTitleList });

    renderToolsSidebar("en", null);

    expect(screen.getByText("Open a workspace first.")).toBeInTheDocument();
    expect(generateTitleList).not.toHaveBeenCalled();
  });

  it("タイトル一覧と目次を生成できる", async () => {
    const generateTitleList = vi.fn().mockResolvedValue({ ok: true, value: "Title List.md" });
    const generateTableOfContents = vi.fn().mockResolvedValue({ ok: true, value: "Toc.md" });
    window.relic = makeRelicApi({ generateTableOfContents, generateTitleList });

    renderToolsSidebar("en");

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

    renderToolsSidebar("ja");

    fireEvent.change(screen.getByLabelText("フィルター"), { target: { value: "frontmatter" } });
    fireEvent.change(screen.getByLabelText("フロントマターフィールド"), { target: { value: "status" } });
    fireEvent.change(screen.getByLabelText("フロントマター値"), { target: { value: "draft" } });
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

    fireEvent.change(within(split).getByLabelText("Source file"), { target: { value: "Book.md" } });
    fireEvent.change(within(split).getByLabelText("Heading level"), { target: { value: "3" } });
    fireEvent.change(within(split).getByLabelText("Output folder"), { target: { value: "Chapters" } });
    fireEvent.click(within(split).getByRole("button", { name: "Split by Heading" }));

    await waitFor(() => {
      expect(splitFileByHeading).toHaveBeenCalledWith({
        headingLevel: 3,
        outputFolder: "Chapters",
        sourcePath: "Book.md"
      });
    });
    expect(await screen.findByText("Done: 2 file(s) created")).toBeInTheDocument();
  });
});
