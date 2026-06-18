import { cleanup, render, screen } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { emptyRelicDiagramMarkdownContent } from "../../shared/diagramMarkdown";
import { I18nProvider } from "../i18n";
import type { FileTab } from "../store/editorStore";
import * as paneViewModel from "../paneViewModel";
import * as largeMarkdown from "../largeMarkdown";
import { PaneContentSurface } from "./PaneContentSurface";

vi.mock("./DiagramCanvas", () => ({
  DiagramCanvas: () => <div>DiagramCanvas</div>
}));

vi.mock("./Editor", () => ({
  Editor: () => <div>Editor</div>
}));

vi.mock("./diagram/diagramCanvasStatus", () => ({
  diagramCanvasStatus: () => "diagram-canvas-status"
}));

const buildSurfaceElement = (activeTab: FileTab, sourceMode = false): ReactElement => (
  <I18nProvider language="en">
    <PaneContentSurface
      activeTab={activeTab}
      allFilePaths={[]}
      editorActionPulse={0}
      editorSettings={defaultEditorSettings}
      frontmatterCandidates={{}}
      renderChartTab={(chartId: string) => <div>Chart {chartId}</div>}
      renderPanelTab={(panel) => <div>Panel {panel}</div>}
      sourceMode={sourceMode}
      typewriterMode={false}
      userDefinedFields={[]}
      viewRef={{ current: null } as React.MutableRefObject<EditorView | null>}
      workspacePath="/workspace"
      onCreateFile={vi.fn()}
      onLoadExternalVersion={vi.fn()}
      onRenameFile={vi.fn()}
      onSaveRelicVersion={vi.fn()}
      onSourceModeToggle={vi.fn()}
      onUpdateTabContent={vi.fn()}
    />
  </I18nProvider>
);

const renderSurface = (activeTab: FileTab, sourceMode = false): ReturnType<typeof render> => {
  return render(buildSurfaceElement(activeTab, sourceMode));
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PaneContentSurface", () => {
  it("reuses text count result while file content stays unchanged", () => {
    const textCountSpy = vi.spyOn(paneViewModel, "textCount");
    const fileTab: FileTab = {
      content: "one two\nthree",
      id: "tab-file",
      kind: "file",
      name: "Note",
      path: "Folder/Note.md",
      savedContent: "one two\nthree"
    };

    const { rerender } = renderSurface(fileTab);
    expect(screen.getByText("13 characters / 3 words")).toBeInTheDocument();
    expect(textCountSpy).toHaveBeenCalledTimes(1);

    const sameContentTab: FileTab = {
      ...fileTab,
      id: "tab-file-2"
    };
    rerender(
      buildSurfaceElement(sameContentTab, false)
    );
    expect(screen.getByText("13 characters / 3 words")).toBeInTheDocument();
    expect(textCountSpy).toHaveBeenCalledTimes(1);

    const changedContentTab: FileTab = {
      ...fileTab,
      id: "tab-file-3",
      content: "hello world",
      savedContent: "hello world"
    };
    rerender(
      buildSurfaceElement(changedContentTab, false)
    );
    expect(screen.getByText("11 characters / 2 words")).toBeInTheDocument();
    expect(textCountSpy).toHaveBeenCalledTimes(2);
  });

  it("does not call text count in diagram mode", () => {
    const textCountSpy = vi.spyOn(paneViewModel, "textCount");
    const diagramTab: FileTab = {
      content: emptyRelicDiagramMarkdownContent,
      id: "tab-diagram",
      kind: "file",
      name: "Diagram",
      path: "Diagram.md",
      savedContent: emptyRelicDiagramMarkdownContent
    };

    renderSurface(diagramTab, false);

    expect(screen.getByText("DiagramCanvas")).toBeInTheDocument();
    expect(screen.getByText("diagram-canvas-status")).toBeInTheDocument();
    expect(textCountSpy).not.toHaveBeenCalled();
  });

  it("routes invalid Diagram candidates to the Diagram canvas", () => {
    const textCountSpy = vi.spyOn(paneViewModel, "textCount");
    const diagramTab: FileTab = {
      content: "---\ntype: diagram\nformatVersion: 999\n---\n\nnodes: []\nlines: []",
      id: "tab-diagram-invalid",
      kind: "file",
      name: "Diagram",
      path: "Diagram.md",
      savedContent: "---\ntype: diagram\nformatVersion: 999\n---\n\nnodes: []\nlines: []"
    };

    renderSurface(diagramTab, false);

    expect(screen.getByText("DiagramCanvas")).toBeInTheDocument();
    expect(screen.getByText("diagram-canvas-status")).toBeInTheDocument();
    expect(textCountSpy).not.toHaveBeenCalled();
  });

  it("does not recalculate large markdown detection when content is unchanged", () => {
    const largeMarkdownSpy = vi.spyOn(largeMarkdown, "isLargeMarkdownContent");
    const fileTab: FileTab = {
      content: "line one\nline two",
      id: "tab-file",
      kind: "file",
      name: "Note",
      path: "Folder/Note.md",
      savedContent: "line one\nline two"
    };

    const { rerender } = renderSurface(fileTab);
    expect(screen.getByText("17 characters / 4 words")).toBeInTheDocument();
    expect(largeMarkdownSpy).toHaveBeenCalledTimes(1);

    const sameContentDifferentId: FileTab = {
      ...fileTab,
      id: "tab-file-2"
    };
    rerender(buildSurfaceElement(sameContentDifferentId, false));
    expect(screen.getByText("17 characters / 4 words")).toBeInTheDocument();
    expect(largeMarkdownSpy).toHaveBeenCalledTimes(1);

    const changedContent: FileTab = {
      ...fileTab,
      id: "tab-file-3",
      content: "short",
      savedContent: "short"
    };
    rerender(buildSurfaceElement(changedContent, false));
    expect(screen.getByText("5 characters / 1 words")).toBeInTheDocument();
    expect(largeMarkdownSpy).toHaveBeenCalledTimes(2);
  });
});
