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
  state,
  workspaceName
}: AIWorkspacePanelProps): ReactElement {
  const [message, setMessage] = useState("");
  const [isClearDataConfirming, setIsClearDataConfirming] = useState(false);
  const history = state?.history ?? [];
  const providerLabel = state?.aiProvider === "openai-api" ? "OpenAI API" : "Codex App Server";
  const sendCurrentMessage = (): void => {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;
    onSendMessage(trimmed);
    setMessage("");
  };

  return (
    <div className="ai-workspace-panel">
      <div className="ai-workspace-header">
        <div>
          <div className="ai-workspace-title">AI</div>
          <div className="ai-workspace-subtitle">
            {workspaceName ? `${workspaceName} のMarkdown共同作業` : "ワークスペース未選択"}
          </div>
        </div>
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

      <div className="ai-workspace-status">
        <span>AI共同作業: {providerLabel}</span>
        <span>
          {state?.index.indexedAt
            ? `${state.index.indexedFileCount} files / ${state.index.chunkCount} chunks`
            : "未インデックス"}
        </span>
      </div>

      {state && state.aiProvider === "openai-api" && !state.openAIAPIKeyConfigured ? (
        <div className="ai-workspace-status-note">
          AIとの会話にはOpenAI APIキーが必要です。設定のAIから登録してください。Markdownの閲覧と編集はこのまま使えます。
        </div>
      ) : null}

      <div className="ai-workspace-messages" aria-live="polite">
        {isLoading && history.length === 0 ? (
          <div className="empty-note">AI Workspaceを読み込んでいます。</div>
        ) : history.length === 0 ? (
          <div className="empty-note">右パネルからMarkdownワークスペースについて話しかけられます。</div>
        ) : (
          history.map((item) => (
            <article className={`ai-workspace-message ai-workspace-message--${item.role}`} key={item.id}>
              <div className="ai-workspace-message-role">{item.role === "user" ? "You" : "AI"}</div>
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
          placeholder="このワークスペースについて相談..."
          value={message}
        />
        <button disabled={isSending || !message.trim()} type="submit">
          {isSending ? "送信中" : "送信"}
        </button>
      </form>
    </div>
  );
}
