import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import { AppOverlays } from "./AppOverlays";

function renderOverlays(): void {
  render(
    <I18nProvider language="ja">
      <div>
        <span>選択できるUI文字</span>
        <div className="cm-editor">
          <span>本文側の文字</span>
        </div>
        <AppOverlays
          aliasesByPath={{}}
          closeToast={vi.fn()}
          commands={[]}
          existingMarkdownPaths={[]}
          handleOpenFile={vi.fn()}
          handleOpenWikiLink={vi.fn()}
          handleRevealWorkspaceItem={vi.fn()}
          isSplit={false}
          isToastClosing={false}
          linkContextMenu={null}
          openWorkspacePathInOtherPane={vi.fn()}
          railTabFlight={null}
          setLinkContextMenu={vi.fn()}
          setShowCommandPalette={vi.fn()}
          setShowQuickSwitcher={vi.fn()}
          showCommandPalette={false}
          showQuickSwitcher={false}
          sidebarCreateFlight={null}
          toastMessage={null}
        />
      </div>
    </I18nProvider>
  );
}

function selectElementText(element: Element): void {
  const selection = window.getSelection();
  const range = document.createRange();

  selection?.removeAllRanges();
  range.selectNodeContents(element);
  selection?.addRange(range);
}

describe("AppOverlays", () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    window.relic = undefined;
  });

  it("UI上で選択した文字を右クリックメニューからコピーできる", async () => {
    const copyEditorTextToClipboard = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    window.relic = makeRelicApi({ copyEditorTextToClipboard });
    renderOverlays();

    const label = screen.getByText("選択できるUI文字");
    selectElementText(label);
    fireEvent.contextMenu(label, { clientX: 24, clientY: 24 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "コピー" }));

    await waitFor(() => {
      expect(copyEditorTextToClipboard).toHaveBeenCalledWith({ text: "選択できるUI文字" });
    });
  });

  it("本文エディタ内の選択文字ではUI選択コピー用メニューを開かない", () => {
    window.relic = makeRelicApi();
    renderOverlays();

    const editorText = screen.getByText("本文側の文字");
    selectElementText(editorText);
    fireEvent.contextMenu(editorText, { clientX: 24, clientY: 24 });

    expect(screen.queryByRole("menuitem", { name: "コピー" })).not.toBeInTheDocument();
  });
});
