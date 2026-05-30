import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
            operationHistory: [],
            pendingOperations: []
          }}
          backlinks={[]}
          isAIWorkspaceLoading={false}
          isAIWorkspaceSending={false}
          aiWorkspaceMessagePreview={null}
          isLoadingBacklinks={false}
          isOpen
          isResizing={false}
          onAIWorkspaceClearData={vi.fn()}
          onAIWorkspaceApplyOperations={vi.fn()}
          onAIWorkspaceCancelMessagePreview={vi.fn()}
          onAIWorkspaceConfirmMessagePreview={vi.fn()}
          onAIWorkspaceDiscardOperations={vi.fn()}
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

  it("shows AI workspace operation history", () => {
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
            operationHistory: [{
              content: "# Auth",
              createdAt: "2026-05-30T00:00:00.000Z",
              id: "op-1",
              kind: "update",
              path: "docs/auth.md",
              status: "applied",
              summary: "認証仕様を更新"
            }],
            pendingOperations: []
          }}
          backlinks={[]}
          isAIWorkspaceLoading={false}
          isAIWorkspaceSending={false}
          aiWorkspaceMessagePreview={null}
          isLoadingBacklinks={false}
          isOpen
          isResizing={false}
          onAIWorkspaceClearData={vi.fn()}
          onAIWorkspaceApplyOperations={vi.fn()}
          onAIWorkspaceCancelMessagePreview={vi.fn()}
          onAIWorkspaceConfirmMessagePreview={vi.fn()}
          onAIWorkspaceDiscardOperations={vi.fn()}
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

    fireEvent.click(screen.getByRole("tab", { name: "変更履歴" }));

    expect(screen.getByText("docs/auth.md")).toBeInTheDocument();
    expect(screen.getByText("反映済み")).toBeInTheDocument();
    expect(screen.getByText("認証仕様を更新")).toBeInTheDocument();
  });

  it("shows pending Markdown operation content without showing delete content", () => {
    const onApply = vi.fn();
    const onDiscard = vi.fn();

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
            operationHistory: [],
            pendingOperations: [
              {
                content: "# New\nbody",
                createdAt: "2026-05-30T00:00:00.000Z",
                id: "op-create",
                kind: "create",
                path: "docs/new.md",
                status: "pending",
                summary: "新規資料を作成"
              },
              {
                content: "# Old\nsecret",
                createdAt: "2026-05-30T00:00:00.000Z",
                id: "op-delete",
                kind: "delete",
                path: "docs/old.md",
                status: "pending",
                summary: "古い資料を削除"
              }
            ]
          }}
          backlinks={[]}
          isAIWorkspaceLoading={false}
          isAIWorkspaceSending={false}
          aiWorkspaceMessagePreview={null}
          isLoadingBacklinks={false}
          isOpen
          isResizing={false}
          onAIWorkspaceClearData={vi.fn()}
          onAIWorkspaceApplyOperations={onApply}
          onAIWorkspaceCancelMessagePreview={vi.fn()}
          onAIWorkspaceConfirmMessagePreview={vi.fn()}
          onAIWorkspaceDiscardOperations={onDiscard}
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

    fireEvent.click(screen.getByText("Markdown内容を確認"));

    expect(screen.getByText((_, element) => element?.tagName === "PRE" && element.textContent === "# New\nbody")).toBeInTheDocument();
    expect(screen.queryByText("# Old\nsecret")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "この変更を反映" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "この変更を取りやめ" })[1]);
    expect(onApply).toHaveBeenCalledWith(["op-create"]);
    expect(onDiscard).toHaveBeenCalledWith(["op-delete"]);
  });

  it("shows Markdown files excluded from AI references", () => {
    render(
      <I18nProvider language="en">
        <AppRightPanel
          aiWorkspaceState={{
            codexAppServerAvailable: true,
            history: [],
            index: {
              chunkCount: 1,
              indexedAt: "2026-05-30T00:00:00.000Z",
              indexedFileCount: 1,
              skippedLargeFiles: [{ path: "large.md", reason: "大きいMarkdownのためAI参照から除外しました。" }],
              unreadableFiles: [{ path: "locked.md", reason: "Markdownを読み込めませんでした。" }]
            },
            operationHistory: [],
            pendingOperations: []
          }}
          backlinks={[]}
          isAIWorkspaceLoading={false}
          isAIWorkspaceSending={false}
          aiWorkspaceMessagePreview={null}
          isLoadingBacklinks={false}
          isOpen
          isResizing={false}
          onAIWorkspaceClearData={vi.fn()}
          onAIWorkspaceApplyOperations={vi.fn()}
          onAIWorkspaceCancelMessagePreview={vi.fn()}
          onAIWorkspaceConfirmMessagePreview={vi.fn()}
          onAIWorkspaceDiscardOperations={vi.fn()}
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

    fireEvent.click(screen.getByText("AI参照から外したMarkdownがあります"));

    expect(screen.getByText("large.md")).toBeInTheDocument();
    expect(screen.getByText("locked.md")).toBeInTheDocument();
    expect(screen.getByText("Markdownを読み込めませんでした。")).toBeInTheDocument();
  });

  it("shows AI message preview references before external send", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <I18nProvider language="en">
        <AppRightPanel
          aiWorkspaceState={{
            codexAppServerAvailable: true,
            history: [],
            index: {
              chunkCount: 1,
              indexedAt: "2026-05-30T00:00:00.000Z",
              indexedFileCount: 1,
              skippedLargeFiles: [],
              unreadableFiles: []
            },
            operationHistory: [],
            pendingOperations: []
          }}
          aiWorkspaceMessagePreview={{
            message: "認証を整理して",
            references: [{ line: 1, path: "docs/auth.md", preview: "# Auth" }],
            requiresExternalAI: true,
            skippedLargeFiles: [],
            unreadableFiles: []
          }}
          backlinks={[]}
          isAIWorkspaceLoading={false}
          isAIWorkspaceSending={false}
          isLoadingBacklinks={false}
          isOpen
          isResizing={false}
          onAIWorkspaceClearData={vi.fn()}
          onAIWorkspaceApplyOperations={vi.fn()}
          onAIWorkspaceCancelMessagePreview={onCancel}
          onAIWorkspaceConfirmMessagePreview={onConfirm}
          onAIWorkspaceDiscardOperations={vi.fn()}
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

    expect(screen.getByText("AIへ送るMarkdown参照")).toBeInTheDocument();
    expect(screen.getByText("docs/auth.md:1")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "送信" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onConfirm).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows a notice when outgoing links are limited", () => {
    render(
      <I18nProvider language="en">
        <AppRightPanel
          aiWorkspaceState={null}
          aiWorkspaceMessagePreview={null}
          backlinks={[]}
          isAIWorkspaceLoading={false}
          isAIWorkspaceSending={false}
          isLoadingBacklinks={false}
          isOpen
          isResizing={false}
          onAIWorkspaceClearData={vi.fn()}
          onAIWorkspaceApplyOperations={vi.fn()}
          onAIWorkspaceCancelMessagePreview={vi.fn()}
          onAIWorkspaceConfirmMessagePreview={vi.fn()}
          onAIWorkspaceDiscardOperations={vi.fn()}
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
