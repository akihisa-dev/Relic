import { useState, type ReactElement } from "react";

import type { AIWorkspaceMessagePreview, AIWorkspaceState } from "../../shared/ipc";

interface AIWorkspacePanelProps {
  isLoading: boolean;
  isSending: boolean;
  messagePreview: AIWorkspaceMessagePreview | null;
  onApplyOperations: (operationIds?: string[]) => void;
  onCancelMessagePreview: () => void;
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
  isLoading,
  isSending,
  onClearData,
  onRebuildIndex,
  onSendMessage,
  state
}: AIWorkspacePanelProps): ReactElement {
  const [message, setMessage] = useState("");
  const [isClearDataConfirming, setIsClearDataConfirming] = useState(false);
  const history = state?.history ?? [];
  const sendCurrentMessage = (): void => {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;
    onSendMessage(trimmed);
    setMessage("");
  };

  return (
    <div className="ai-workspace-panel">
      <div className="ai-workspace-header-actions">
        <button className="ai-workspace-icon-button" onClick={onRebuildIndex} title="インデックスを更新" type="button">
          ↻
        </button>
        <button
          className="ai-workspace-icon-button"
          onClick={() => setIsClearDataConfirming(true)}
          title="AIデータを削除"
          type="button"
        >
          ×
        </button>
      </div>

      {isClearDataConfirming ? (
        <section className="ai-workspace-clear-confirm">
          <p>AIデータを削除します。Markdownファイルは変更しません。</p>
          <div>
            <button onClick={() => setIsClearDataConfirming(false)} type="button">
              キャンセル
            </button>
            <button
              onClick={() => {
                setIsClearDataConfirming(false);
                onClearData();
              }}
              type="button"
            >
              削除
            </button>
          </div>
        </section>
      ) : null}

      <div className="ai-workspace-messages" aria-live="polite">
        {isLoading && history.length === 0 ? null : (
          history.map((item) => (
            <article className={`ai-workspace-message ai-workspace-message--${item.role}`} key={item.id}>
              <p>{item.content}</p>
            </article>
          ))
        )}
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
          onKeyDown={(event) => {
            if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
            event.preventDefault();
            sendCurrentMessage();
          }}
          onChange={(event) => setMessage(event.target.value)}
          value={message}
        />
        <button disabled={isSending || !message.trim()} type="submit">
          {isSending ? "送信中" : "送信"}
        </button>
      </form>
    </div>
  );
}
