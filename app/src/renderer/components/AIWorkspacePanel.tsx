import { useLayoutEffect, useRef, useState, type ReactElement } from "react";

import type { AIWorkspaceMessagePreview, AIWorkspaceState } from "../../shared/ipc";

interface AIWorkspacePanelProps {
  isLoading: boolean;
  isSending: boolean;
  messagePreview: AIWorkspaceMessagePreview | null;
  onApplyOperations: (operationIds?: string[]) => void;
  onCancelMessagePreview: () => void;
  onCancelSending: () => void;
  onClearData: () => void;
  onConfirmMessagePreview: () => void;
  onDiscardOperations: (operationIds?: string[]) => void;
  onOpenFile: (path: string) => void;
  onRebuildIndex: () => void;
  onSendMessage: (message: string) => void;
  state: AIWorkspaceState | null;
  workspaceName?: string | null;
}

export function AIWorkspacePanel({
  isSending,
  onCancelSending,
  onSendMessage,
  state
}: AIWorkspacePanelProps): ReactElement {
  const [message, setMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const history = state?.history ?? [];
  const sendCurrentMessage = (): void => {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;
    onSendMessage(trimmed);
    setMessage("");
  };
  const startEditingMessage = (id: string, content: string): void => {
    setEditingMessageId(id);
    setEditingMessage(content);
  };
  const cancelEditingMessage = (): void => {
    setEditingMessageId(null);
    setEditingMessage("");
  };
  const resendEditedMessage = (): void => {
    const trimmed = editingMessage.trim();
    if (!trimmed || isSending) return;
    onSendMessage(trimmed);
    cancelEditingMessage();
  };

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (!message) {
      textarea.style.height = "";
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [message]);

  return (
    <div className="ai-workspace-panel">
      <div className="ai-workspace-messages" aria-live="polite">
        {history.map((item) => (
          <article className={`ai-workspace-message ai-workspace-message--${item.role}`} key={item.id}>
            {editingMessageId === item.id ? (
              <div className="ai-workspace-message-edit">
                <textarea
                  aria-label="ユーザー発言を編集"
                  onChange={(event) => setEditingMessage(event.target.value)}
                  rows={3}
                  value={editingMessage}
                />
                <div className="ai-workspace-message-actions">
                  <button disabled={isSending || !editingMessage.trim()} onClick={resendEditedMessage} type="button">
                    再送信
                  </button>
                  <button onClick={cancelEditingMessage} type="button">
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p>{item.content}</p>
                {item.role === "user" ? (
                  <div className="ai-workspace-message-actions">
                    <button
                      disabled={isSending}
                      onClick={() => startEditingMessage(item.id, item.content)}
                      type="button"
                    >
                      編集
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </article>
        ))}
      </div>

      <form
        className="ai-workspace-form"
        onSubmit={(event) => {
          event.preventDefault();
          sendCurrentMessage();
        }}
      >
        <textarea
          aria-label="AIへのメッセージ"
          disabled={isSending}
          ref={textareaRef}
          rows={1}
          onKeyDown={(event) => {
            if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
            event.preventDefault();
            sendCurrentMessage();
          }}
          onChange={(event) => setMessage(event.target.value)}
          value={message}
        />
        {isSending ? (
          <button aria-label="AI応答を中断" onClick={onCancelSending} type="button">
            <span aria-hidden="true">■</span>
          </button>
        ) : (
          <button aria-label="送信" disabled={!message.trim()} type="submit">
            <span aria-hidden="true">↑</span>
          </button>
        )}
      </form>
    </div>
  );
}
