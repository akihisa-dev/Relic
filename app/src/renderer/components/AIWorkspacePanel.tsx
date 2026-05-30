import { useState, type ReactElement } from "react";

import type { AIWorkspaceState } from "../../shared/ipc";

interface AIWorkspacePanelProps {
  isLoading: boolean;
  isSending: boolean;
  onClearData: () => void;
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
  onOpenFile,
  onRebuildIndex,
  onSendMessage,
  state,
  workspaceName
}: AIWorkspacePanelProps): ReactElement {
  const [message, setMessage] = useState("");
  const history = state?.history ?? [];

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
          <button className="ai-workspace-icon-button" onClick={onClearData} title="AIデータを削除" type="button">
            ×
          </button>
        </div>
      </div>

      <div className="ai-workspace-status">
        <span>{state?.codexAppServerAvailable ? "Codex App Server: 利用可能" : "Codex App Server: 未検出"}</span>
        <span>
          {state?.index.indexedAt
            ? `${state.index.indexedFileCount} files / ${state.index.chunkCount} chunks`
            : "未インデックス"}
        </span>
      </div>

      {state?.index.skippedLargeFiles.length || state?.index.unreadableFiles.length ? (
        <div className="ai-workspace-note">
          AI参照から外したMarkdownがあります。
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
              {item.references.length > 0 ? (
                <ul className="ai-workspace-references">
                  {item.references.map((reference) => (
                    <li key={`${item.id}-${reference.path}-${reference.line ?? 0}`}>
                      <button onClick={() => onOpenFile(reference.path)} title={reference.path} type="button">
                        {reference.path}{reference.line ? `:${reference.line}` : ""}
                      </button>
                      <span>{reference.preview}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))
        )}
      </div>

      <form
        className="ai-workspace-form"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = message.trim();
          if (!trimmed) return;
          onSendMessage(trimmed);
          setMessage("");
        }}
      >
        <textarea
          aria-label="AIへのメッセージ"
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
