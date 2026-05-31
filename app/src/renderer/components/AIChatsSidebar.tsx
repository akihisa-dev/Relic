import { useState, type ReactElement } from "react";

import type { AIWorkspaceState, AIWorkspaceUsageWindow } from "../../shared/ipc";

interface AIChatsSidebarProps {
  isLoading: boolean;
  onCreateChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onSelectChat: (chatId: string) => void;
  state: AIWorkspaceState | null;
}

export function AIChatsSidebar({
  isLoading,
  onCreateChat,
  onDeleteChat,
  onSelectChat,
  state
}: AIChatsSidebarProps): ReactElement {
  const [confirmingChatId, setConfirmingChatId] = useState<string | null>(null);
  const chats = state?.chats ?? [];
  const activeChatId = state?.activeChatId ?? null;

  return (
    <div className="ai-chats-sidebar">
      <div className="ai-chats-sidebar-actions">
        <button
          className="ai-chats-new-button"
          disabled={isLoading}
          onClick={onCreateChat}
          type="button"
        >
          新規チャット
        </button>
      </div>
      {chats.length > 0 ? (
        <ol className="ai-chats-list" aria-label="AIチャット履歴">
          {chats.map((chat) => (
            <li className="ai-chats-item" key={chat.id}>
              <div className="ai-chats-item-row">
                <button
                  className={`ai-chats-item-button${chat.id === activeChatId ? " ai-chats-item-button--active" : ""}`}
                  onClick={() => onSelectChat(chat.id)}
                  title={chat.title}
                  type="button"
                >
                  <span className="ai-chats-item-title">{chat.title}</span>
                  <span className="ai-chats-item-meta">
                    {chat.messageCount > 0 ? `${chat.messageCount}件` : "未開始"}
                  </span>
                </button>
                <button
                  aria-label={`${chat.title}を削除`}
                  className="ai-chats-delete-button"
                  disabled={isLoading}
                  onClick={() => setConfirmingChatId(chat.id)}
                  title="削除"
                  type="button"
                >
                  ×
                </button>
              </div>
              {confirmingChatId === chat.id ? (
                <div className="ai-chats-delete-confirm">
                  <p>このチャットを削除しますか？Markdownファイルには影響しません。</p>
                  <div>
                    <button
                      disabled={isLoading}
                      onClick={() => {
                        onDeleteChat(chat.id);
                        setConfirmingChatId(null);
                      }}
                      type="button"
                    >
                      削除
                    </button>
                    <button
                      disabled={isLoading}
                      onClick={() => setConfirmingChatId(null)}
                      type="button"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="empty-note">AIチャットはまだありません。</div>
      )}
      {state?.aiProvider === "codex-app-server" ? (
        <CodexUsagePanel state={state} />
      ) : null}
    </div>
  );
}

function CodexUsagePanel({ state }: { state: AIWorkspaceState }): ReactElement {
  const usage = state.codexUsage ?? null;
  const windows = [
    usage?.primary ? { id: "primary", label: formatUsageWindowLabel(usage.primary), window: usage.primary } : null,
    usage?.secondary ? { id: "secondary", label: formatUsageWindowLabel(usage.secondary), window: usage.secondary } : null
  ].filter((item): item is { id: string; label: string; window: AIWorkspaceUsageWindow } => Boolean(item));

  return (
    <section aria-label="Codex残り使用量" className="ai-usage-panel">
      <div className="ai-usage-heading">
        <span className="ai-usage-gauge" aria-hidden="true" />
        <span>残り使用量</span>
      </div>
      {windows.length > 0 ? (
        <div className="ai-usage-rows">
          {windows.map((item) => (
            <div className="ai-usage-row" key={item.id}>
              <span className="ai-usage-window">{item.label}</span>
              <span className="ai-usage-percent">{item.window.remainingPercent}%</span>
              <span className="ai-usage-reset">{formatUsageReset(item.window.resetsAt)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="ai-usage-empty">使用量を取得できません</p>
      )}
    </section>
  );
}

function formatUsageWindowLabel(window: AIWorkspaceUsageWindow): string {
  const mins = window.windowDurationMins;
  if (!mins) return "現在";
  if (mins === 10080) return "1週間";
  if (mins % 1440 === 0) return `${mins / 1440}日`;
  if (mins % 60 === 0) return `${mins / 60}時間`;

  return `${mins}分`;
}

function formatUsageReset(resetsAt: string | null): string {
  if (!resetsAt) return "";
  const resetDate = new Date(resetsAt);
  if (Number.isNaN(resetDate.getTime())) return "";
  const now = new Date();
  const isToday = resetDate.getFullYear() === now.getFullYear() &&
    resetDate.getMonth() === now.getMonth() &&
    resetDate.getDate() === now.getDate();

  if (isToday) {
    return `${String(resetDate.getHours()).padStart(2, "0")}:${String(resetDate.getMinutes()).padStart(2, "0")}`;
  }

  return `${resetDate.getMonth() + 1}月${resetDate.getDate()}日`;
}
