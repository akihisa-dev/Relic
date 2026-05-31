import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { AppSecondarySidebar } from "./AppSecondarySidebar";

const aiWorkspaceState = {
  aiProvider: "codex-app-server" as const,
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
};

function renderSecondarySidebar(overrides: Partial<Parameters<typeof AppSecondarySidebar>[0]> = {}) {
  const props: Parameters<typeof AppSecondarySidebar>[0] = {
    aiWorkspaceState,
    aiWorkspaceMessagePreview: null,
    isAIWorkspaceLoading: false,
    isAIWorkspaceSending: false,
    isOpen: true,
    isResizing: false,
    onAIWorkspaceApplyOperations: vi.fn(),
    onAIWorkspaceCancelMessagePreview: vi.fn(),
    onAIWorkspaceCancelSending: vi.fn(),
    onAIWorkspaceClearData: vi.fn(),
    onAIWorkspaceConfirmMessagePreview: vi.fn(),
    onAIWorkspaceDiscardOperations: vi.fn(),
    onAIWorkspaceRebuildIndex: vi.fn(),
    onAIWorkspaceSendMessage: vi.fn(),
    onClose: vi.fn(),
    onOpenFile: vi.fn(),
    onResizeStart: vi.fn(),
    view: "ai-chat",
    width: 400,
    workspaceName: "Novel",
    ...overrides
  };

  return render(
    <I18nProvider language="en">
      <AppSecondarySidebar {...props} />
    </I18nProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppSecondarySidebar", () => {
  it("renders the AI workspace panel in the secondary sidebar", () => {
    renderSecondarySidebar();

    expect(screen.getByLabelText("AIチャット")).toHaveClass("secondary-sidebar");
    expect(screen.getByLabelText("AIへのメッセージ")).toBeInTheDocument();
  });

  it("keeps AI workspace focused on conversation without operation tabs", () => {
    renderSecondarySidebar({
      aiWorkspaceState: {
        ...aiWorkspaceState,
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
        }]
      }
    });

    expect(screen.queryByRole("tab", { name: "変更履歴" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /作業中の変更/ })).not.toBeInTheDocument();
    expect(screen.getByText(/READMEを更新しました。/)).toBeInTheDocument();
    expect(screen.queryByText("認証仕様を更新")).not.toBeInTheDocument();
  });

  it("sends an AI workspace message with command enter", () => {
    const onSendMessage = vi.fn();
    renderSecondarySidebar({ onAIWorkspaceSendMessage: onSendMessage });

    const input = screen.getByLabelText("AIへのメッセージ");
    fireEvent.change(input, { target: { value: "要件を整理して" } });
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });

    expect(onSendMessage).toHaveBeenCalledWith("要件を整理して");
    expect(input).toHaveValue("");
  });

  it("shows a stop button while sending and can cancel the running response", () => {
    const onCancelSending = vi.fn();
    renderSecondarySidebar({ isAIWorkspaceSending: true, onAIWorkspaceCancelSending: onCancelSending });

    fireEvent.click(screen.getByRole("button", { name: "AI応答を中断" }));

    expect(onCancelSending).toHaveBeenCalled();
  });

  it("edits a sent user message and resends the edited text", () => {
    const onSendMessage = vi.fn();
    renderSecondarySidebar({
      onAIWorkspaceSendMessage: onSendMessage,
      aiWorkspaceState: {
        ...aiWorkspaceState,
        history: [{
          content: "最初の依頼",
          createdAt: "2026-05-31T00:00:00.000Z",
          id: "message-user-1",
          references: [],
          role: "user"
        }]
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    const editInput = screen.getByLabelText("ユーザー発言を編集");
    fireEvent.change(editInput, { target: { value: "修正後の依頼" } });
    fireEvent.click(screen.getByRole("button", { name: "再送信" }));

    expect(onSendMessage).toHaveBeenCalledWith("修正後の依頼");
  });

  it("expands the AI workspace input to fit the typed message", () => {
    renderSecondarySidebar();

    const input = screen.getByLabelText("AIへのメッセージ");
    expect(input).toHaveAttribute("rows", "1");
    expect((input as HTMLTextAreaElement).style.height).toBe("");

    Object.defineProperty(input, "scrollHeight", {
      configurable: true,
      value: 96
    });
    fireEvent.change(input, { target: { value: "1行目\n2行目\n3行目" } });

    expect(input).toHaveStyle({ height: "96px" });
  });

  it("can be closed independently", () => {
    const onClose = vi.fn();
    renderSecondarySidebar({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "AIチャットを閉じる" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("renders a resize handle for the AI chat panel", () => {
    const onResizeStart = vi.fn();
    renderSecondarySidebar({ isResizing: true, onResizeStart });

    const resizeHandle = screen.getByRole("button", { name: "AIチャットの幅を変更" });
    expect(screen.getByLabelText("AIチャット")).toHaveClass("secondary-sidebar--resizing");
    expect(resizeHandle).toHaveClass("secondary-sidebar-resize-handle--active");

    fireEvent.mouseDown(resizeHandle, { clientX: 400 });

    expect(onResizeStart).toHaveBeenCalled();
  });
});
