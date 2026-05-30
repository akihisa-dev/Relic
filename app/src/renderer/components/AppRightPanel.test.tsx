import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResolvedWikiLink } from "../../shared/links";
import { I18nProvider } from "../i18n";
import { AppRightPanel } from "./AppRightPanel";

const outgoingLink: ResolvedWikiLink = {
  displayName: "Target",
  exists: true,
  path: "Target.md",
  wikiLink: {
    alias: null,
    blockId: null,
    heading: null,
    kind: "link",
    raw: "[[Target]]",
    target: "Target"
  }
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppRightPanel", () => {
  it("shows the AI workspace panel", () => {
    render(
      <I18nProvider language="en">
        <AppRightPanel
          aiWorkspaceState={{
            codexAppServerAvailable: true,
            history: [],
            index: {
              chunkCount: 3,
              indexedAt: "2026-05-30T00:00:00.000Z",
              indexedFileCount: 2,
              skippedLargeFiles: [],
              unreadableFiles: []
            },
            pendingOperations: []
          }}
          backlinks={[]}
          isAIWorkspaceLoading={false}
          isAIWorkspaceSending={false}
          isLoadingBacklinks={false}
          isOpen
          isResizing={false}
          onAIWorkspaceClearData={vi.fn()}
          onAIWorkspaceApplyOperations={vi.fn()}
          onAIWorkspaceRebuildIndex={vi.fn()}
          onAIWorkspaceSendMessage={vi.fn()}
          onOpenFile={vi.fn()}
          onOpenWikiLink={vi.fn()}
          onOutlineHeadingClick={vi.fn()}
          onResizeStart={vi.fn()}
          outlineHeadings={[]}
          outgoingLinks={[]}
          outgoingLinksLimited={false}
          rightPanelView="ai"
          setLinkContextMenu={vi.fn()}
          width={260}
          workspaceName="Novel"
        />
      </I18nProvider>
    );

    expect(screen.getByText("Novel のMarkdown共同作業")).toBeInTheDocument();
    expect(screen.getByText("2 files / 3 chunks")).toBeInTheDocument();
  });

  it("shows a notice when outgoing links are limited", () => {
    render(
      <I18nProvider language="en">
        <AppRightPanel
          aiWorkspaceState={null}
          backlinks={[]}
          isAIWorkspaceLoading={false}
          isAIWorkspaceSending={false}
          isLoadingBacklinks={false}
          isOpen
          isResizing={false}
          onAIWorkspaceClearData={vi.fn()}
          onAIWorkspaceApplyOperations={vi.fn()}
          onAIWorkspaceRebuildIndex={vi.fn()}
          onAIWorkspaceSendMessage={vi.fn()}
          onOpenFile={vi.fn()}
          onOpenWikiLink={vi.fn()}
          onOutlineHeadingClick={vi.fn()}
          onResizeStart={vi.fn()}
          outlineHeadings={[]}
          outgoingLinks={[outgoingLink]}
          outgoingLinksLimited
          rightPanelView="links"
          setLinkContextMenu={vi.fn()}
          width={260}
        />
      </I18nProvider>
    );

    expect(screen.getByText("Only some links are shown because there are many links.")).toBeInTheDocument();
  });
});
