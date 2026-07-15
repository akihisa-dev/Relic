import { cleanup, render, screen } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import type { FileTab, Tab } from "../store/editorStore";
import * as paneViewModel from "../paneViewModel";
import * as largeMarkdown from "../largeMarkdown";
import { PaneContentSurface } from "./PaneContentSurface";

vi.mock("./Editor", () => ({
  Editor: () => <div>Editor</div>
}));

const buildSurfaceElement = (
  activeTab: Tab,
  sourceMode = false,
  workspaceDataRevision = 0
): ReactElement => (
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
      workspaceDataRevision={workspaceDataRevision}
      onCreateFile={vi.fn()}
      onLoadExternalVersion={vi.fn()}
      onRenameFile={vi.fn()}
      onSaveRelicVersion={vi.fn()}
      onSourceModeToggle={vi.fn()}
      onUpdateTabContent={vi.fn()}
    />
  </I18nProvider>
);

const renderSurface = (activeTab: Tab, sourceMode = false): ReturnType<typeof render> => {
  return render(buildSurfaceElement(activeTab, sourceMode));
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.relic = undefined;
});

describe("PaneContentSurface", () => {
  it("画像タブはワークスペース内画像を実画像として表示する", async () => {
    const readImageFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { dataUrl: "data:image/jpeg;base64,aW1hZ2U=" }
    });
    window.relic = makeRelicApi({ readImageFile });

    renderSurface({
      id: "image-tab",
      kind: "image",
      name: "map.jpg",
      path: "assets/map.jpg"
    });

    expect(await screen.findByRole("img", { name: "map.jpg" })).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,aW1hZ2U="
    );
    expect(readImageFile).toHaveBeenCalledWith({ path: "assets/map.jpg" });
    expect(screen.queryByText(/characters/)).not.toBeInTheDocument();
  });

  it("ワークスペース再同期後は開いている画像を再取得する", async () => {
    const readImageFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        value: { dataUrl: "data:image/jpeg;base64,b2xk" }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { dataUrl: "data:image/jpeg;base64,bmV3" }
      });
    window.relic = makeRelicApi({ readImageFile });
    const imageTab: Tab = {
      id: "image-tab",
      kind: "image",
      name: "map.jpg",
      path: "assets/map.jpg"
    };

    const { rerender } = render(buildSurfaceElement(imageTab));
    expect(await screen.findByRole("img", { name: "map.jpg" })).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,b2xk"
    );

    rerender(buildSurfaceElement(imageTab, false, 1));

    expect(await screen.findByRole("img", { name: "map.jpg" })).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,bmV3"
    );
    expect(readImageFile).toHaveBeenCalledTimes(2);
  });

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

  it("treats frontmatter markdown as normal markdown", () => {
    const textCountSpy = vi.spyOn(paneViewModel, "textCount");
    const content = "---\ntitle: Note\n---\n\n# Note";
    const fileTab: FileTab = {
      content,
      id: "tab-frontmatter",
      kind: "file",
      name: "Note",
      path: "Note.md",
      savedContent: content
    };

    renderSurface(fileTab, false);

    expect(screen.getByText("27 characters / 6 words")).toBeInTheDocument();
    expect(textCountSpy).toHaveBeenCalledTimes(1);
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
