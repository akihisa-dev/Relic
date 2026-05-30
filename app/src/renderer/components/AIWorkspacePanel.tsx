import { useState, type ReactElement } from "react";

import type { AIWorkspaceMessagePreview, AIWorkspaceState } from "../../shared/ipc";

type AIWorkspacePanelView = "chat" | "history";

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
  messagePreview,
  onApplyOperations,
  onCancelMessagePreview,
  onClearData,
  onConfirmMessagePreview,
  onDiscardOperations,
  onOpenFile,
  onRebuildIndex,
  onSendMessage,
  state,
  workspaceName
}: AIWorkspacePanelProps): ReactElement {
  const [message, setMessage] = useState("");
  const [panelView, setPanelView] = useState<AIWorkspacePanelView>("chat");
  const history = state?.history ?? [];
  const operationHistory = state?.operationHistory ?? [];
  const pendingOperations = state?.pendingOperations ?? [];
  const skippedFiles = [
    ...(state?.index.skippedLargeFiles ?? []),
    ...(state?.index.unreadableFiles ?? [])
  ];
  const previewSkippedFiles = [
    ...(messagePreview?.skippedLargeFiles ?? []),
    ...(messagePreview?.unreadableFiles ?? [])
  ];

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

      {skippedFiles.length > 0 ? (
        <details className="ai-workspace-note">
          <summary>AI参照から外したMarkdownがあります</summary>
          <ul>
            {skippedFiles.map((file) => (
              <li key={`${file.path}-${file.reason}`}>
                <button onClick={() => onOpenFile(file.path)} title={file.path} type="button">
                  <span>{file.path}</span>
                  <strong>開く</strong>
                </button>
                <small>{file.reason}</small>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="ai-workspace-tabs" role="tablist" aria-label="AI Workspace表示">
        <button
          aria-selected={panelView === "chat"}
          onClick={() => setPanelView("chat")}
          role="tab"
          type="button"
        >
          会話
        </button>
        <button
          aria-selected={panelView === "history"}
          onClick={() => setPanelView("history")}
          role="tab"
          type="button"
        >
          変更履歴
        </button>
      </div>

      {pendingOperations.length > 0 ? (
        <section className="ai-workspace-operations">
          <div className="ai-workspace-operations-header">
            <span>作業中の変更</span>
            <div className="ai-workspace-operations-actions">
              <button disabled={isSending} onClick={() => onDiscardOperations()} type="button">
                取りやめ
              </button>
              <button disabled={isSending} onClick={() => onApplyOperations()} type="button">
                反映
              </button>
            </div>
          </div>
          <ul>
            {pendingOperations.map((operation) => (
              <li key={operation.id}>
                <button onClick={() => onOpenFile(operation.path)} title={operation.path} type="button">
                  <span>{operation.path}</span>
                  <strong>開く</strong>
                </button>
                <span>{operation.kind === "create" ? "作成" : operation.kind === "update" ? "編集" : "削除"}</span>
                <small>{operation.summary}</small>
                <div className="ai-workspace-operation-actions">
                  <button disabled={isSending} onClick={() => onDiscardOperations([operation.id])} type="button">
                    この変更を取りやめ
                  </button>
                  <button disabled={isSending} onClick={() => onApplyOperations([operation.id])} type="button">
                    この変更を反映
                  </button>
                </div>
                {operation.kind !== "delete" && operation.content ? (
                  <details className="ai-workspace-operation-preview">
                    <summary>Markdown内容を確認</summary>
                    {operation.kind === "update" && operation.baseContent ? (
                      <div className="ai-workspace-operation-compare">
                        <section>
                          <span>変更前</span>
                          <pre>{operation.baseContent}</pre>
                        </section>
                        <section>
                          <span>変更後</span>
                          <pre>{operation.content}</pre>
                        </section>
                      </div>
                    ) : (
                      <pre>{operation.content}</pre>
                    )}
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {messagePreview ? (
        <section className="ai-workspace-preview">
          <div className="ai-workspace-preview-header">
            <span>AIへ送るMarkdown参照</span>
            <div className="ai-workspace-preview-actions">
              <button disabled={isSending} onClick={onCancelMessagePreview} type="button">
                キャンセル
              </button>
              <button disabled={isSending} onClick={onConfirmMessagePreview} type="button">
                送信
              </button>
            </div>
          </div>
          <p>{messagePreview.message}</p>
          {messagePreview.references.length > 0 ? (
            <ul>
              {messagePreview.references.map((reference) => (
                <li key={`${reference.path}-${reference.line ?? 0}`}>
                  <button onClick={() => onOpenFile(reference.path)} title={reference.path} type="button">
                    <span>{reference.path}{reference.line ? `:${reference.line}` : ""}</span>
                    <strong>開く</strong>
                  </button>
                  <small>{reference.preview}</small>
                </li>
              ))}
            </ul>
          ) : (
            <small>関連しそうなMarkdownは見つかりませんでした。</small>
          )}
          {previewSkippedFiles.length > 0 ? (
            <details className="ai-workspace-preview-skipped">
              <summary>AIに送らないMarkdown</summary>
              <ul>
                {previewSkippedFiles.map((file) => (
                  <li key={`${file.path}-${file.reason}`}>
                    <button onClick={() => onOpenFile(file.path)} title={file.path} type="button">
                      <span>{file.path}</span>
                      <strong>開く</strong>
                    </button>
                    <small>{file.reason}</small>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      {panelView === "chat" ? (
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
                          <span>{reference.path}{reference.line ? `:${reference.line}` : ""}</span>
                          <strong>開く</strong>
                        </button>
                        <span>{reference.preview}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {item.operations?.length ? (
                  <ul className="ai-workspace-message-operations">
                    {item.operations.map((operation) => (
                      <li key={operation.id}>
                        {operationKindLabel(operation.kind)}: {operation.path}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="ai-workspace-history">
          {operationHistory.length === 0 ? (
            <div className="empty-note">AIによるMarkdown変更履歴はまだありません。</div>
          ) : (
            <ul>
              {[...operationHistory].reverse().map((operation) => (
                <li key={operation.id}>
                  <button onClick={() => onOpenFile(operation.path)} title={operation.path} type="button">
                    <span>{operation.path}</span>
                    <strong>開く</strong>
                  </button>
                  <div>
                    <span>{operationKindLabel(operation.kind)}</span>
                    <span>{operationStatusLabel(operation.status)}</span>
                    <time dateTime={operation.createdAt}>{formatOperationTime(operation.createdAt)}</time>
                  </div>
                  <small>{operation.summary}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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

function operationKindLabel(kind: "create" | "update" | "delete"): string {
  if (kind === "create") return "作成";
  if (kind === "update") return "編集";
  return "削除";
}

function operationStatusLabel(status: "pending" | "applied" | "discarded" | "failed" | "stale" | "replaced"): string {
  if (status === "pending") return "未反映";
  if (status === "applied") return "反映済み";
  if (status === "discarded") return "取りやめ";
  if (status === "replaced") return "置き換え済み";
  if (status === "stale") return "再作業が必要";
  return "失敗";
}

function formatOperationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ja-JP", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit"
  });
}
