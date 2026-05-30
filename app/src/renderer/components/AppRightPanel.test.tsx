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
            aiProvider: "codex-app-server",
            openAIAPIKeyConfigured: true,
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
    expect(screen.getByText("AI共同作業: Codex App Server")).toBeInTheDocument();
    expect(screen.getByText("2 files / 3 chunks")).toBeInTheDocument();
  });

  it("explains when AI workspace conversation is unavailable", () => {
    render(
      <I18nProvider language="en">
        <AppRightPanel
          aiWorkspaceState={{
            aiProvider: "openai-api",
            openAIAPIKeyConfigured: false,
            history: [],
            index: {
              chunkCount: 0,
              indexedAt: null,
              indexedFileCount: 0,
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

    expect(screen.getByText("AI共同作業: OpenAI API")).toBeInTheDocument();
    expect(screen.getByText("AIとの会話にはOpenAI APIキーが必要です。設定のAIから登録してください。Markdownの閲覧と編集はこのまま使えます。")).toBeInTheDocument();
  });

  it("confirms before clearing AI workspace data", () => {
    const onClearData = vi.fn();

    render(
      <I18nProvider language="en">
        <AppRightPanel
          aiWorkspaceState={{
            aiProvider: "codex-app-server",
            openAIAPIKeyConfigured: true,
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
          onAIWorkspaceClearData={onClearData}
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

    fireEvent.click(screen.getByTitle("AIデータを削除"));

    expect(screen.getByText("AIデータを削除します。Markdownファイルは変更しません。")).toBeInTheDocument();
    expect(onClearData).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(onClearData).toHaveBeenCalled();
  });

  it("keeps AI workspace focused on conversation without operation tabs", () => {
    render(
      <I18nProvider language="en">
        <AppRightPanel
          aiWorkspaceState={{
            aiProvider: "codex-app-server",
            openAIAPIKeyConfigured: true,
            history: [{
              content: "READMEを更新しました。\n\nMarkdownへ反映しました。\n- docs/auth.md",
              createdAt: "2026-05-30T00:00:00.000Z",
              id: "message-1",
              operations: [{
                content: "# Auth",
                createdAt: "2026-05-30T00:00:00.000Z",
                id: "op-1",
                kind: "update",
                path: "docs/auth.md",
                status: "applied",
                summary: "認証仕様を更新"
              }],
              references: [{ path: "README.md", preview: "# README" }],
              role: "assistant"
            }],
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

    expect(screen.queryByRole("tab", { name: "変更履歴" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /作業中の変更/ })).not.toBeInTheDocument();
    expect(screen.getByText(/READMEを更新しました。/)).toBeInTheDocument();
    expect(screen.queryByText("認証仕様を更新")).not.toBeInTheDocument();
  });

  it("sends an AI workspace message with command enter", () => {
    const onSendMessage = vi.fn();

    render(
      <I18nProvider language="en">
        <AppRightPanel
          aiWorkspaceState={{
            aiProvider: "codex-app-server",
            openAIAPIKeyConfigured: true,
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
          onAIWorkspaceSendMessage={onSendMessage}
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

    const input = screen.getByLabelText("AIへのメッセージ");
    fireEvent.change(input, { target: { value: "要件を整理して" } });
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });

    expect(onSendMessage).toHaveBeenCalledWith("要件を整理して");
    expect(input).toHaveValue("");
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
