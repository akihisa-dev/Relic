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
    onAIWorkspaceApplyOperations: vi.fn(),
    onAIWorkspaceCancelMessagePreview: vi.fn(),
    onAIWorkspaceClearData: vi.fn(),
    onAIWorkspaceConfirmMessagePreview: vi.fn(),
    onAIWorkspaceDiscardOperations: vi.fn(),
    onAIWorkspaceRebuildIndex: vi.fn(),
    onAIWorkspaceSendMessage: vi.fn(),
    onClose: vi.fn(),
    onOpenFile: vi.fn(),
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
});
