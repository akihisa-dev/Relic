import type { ReactElement } from "react";

import type { AIWorkspaceState } from "../../shared/ipc";

interface AIChatsSidebarProps {
  isLoading: boolean;
  onCreateChat: () => void;
  onSelectChat: (chatId: string) => void;
  state: AIWorkspaceState | null;
}

export function AIChatsSidebar({
  isLoading,
  onCreateChat,
  onSelectChat,
  state
}: AIChatsSidebarProps): ReactElement {
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
            </li>
          ))}
        </ol>
      ) : (
        <div className="empty-note">AIチャットはまだありません。</div>
      )}
    </div>
  );
}
