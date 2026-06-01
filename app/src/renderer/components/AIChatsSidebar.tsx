import { useState, type ReactElement } from "react";

import type { AIWorkspaceState, AIWorkspaceUsageWindow } from "../../shared/ipc";
import { useT } from "../i18n";
import type { Translator } from "../i18nModel";

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
  const t = useT();
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
          {t("aiChat.new")}
        </button>
      </div>
      {chats.length > 0 ? (
        <ol className="ai-chats-list" aria-label={t("aiChat.history")}>
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
                    {chat.messageCount > 0 ? t("aiChat.messageCount", { count: chat.messageCount }) : t("aiChat.notStarted")}
                  </span>
                </button>
                <button
                  aria-label={t("aiChat.deleteChat", { title: chat.title })}
                  className="ai-chats-delete-button"
                  disabled={isLoading}
                  onClick={() => setConfirmingChatId(chat.id)}
                  title={t("aiChat.delete")}
                  type="button"
                >
                  ×
                </button>
              </div>
              {confirmingChatId === chat.id ? (
                <div className="ai-chats-delete-confirm">
                  <p>{t("aiChat.deleteConfirm")}</p>
                  <div>
                    <button
                      disabled={isLoading}
                      onClick={() => {
                        onDeleteChat(chat.id);
                        setConfirmingChatId(null);
                      }}
                      type="button"
                    >
                      {t("aiChat.delete")}
                    </button>
                    <button
                      disabled={isLoading}
                      onClick={() => setConfirmingChatId(null)}
                      type="button"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="empty-note">{t("aiChat.empty")}</div>
      )}
      {state?.aiProvider === "codex-app-server" ? (
        <CodexUsagePanel state={state} t={t} />
      ) : state?.aiProvider === "openai-api" ? (
        <OpenAIAPIUsagePanel t={t} />
      ) : null}
    </div>
  );
}

function CodexUsagePanel({ state, t }: { state: AIWorkspaceState; t: Translator }): ReactElement {
  const usage = state.codexUsage ?? null;
  const windows = [
    usage?.primary ? { id: "primary", label: formatUsageWindowLabel(usage.primary, t), window: usage.primary } : null,
    usage?.secondary ? { id: "secondary", label: formatUsageWindowLabel(usage.secondary, t), window: usage.secondary } : null
  ].filter((item): item is { id: string; label: string; window: AIWorkspaceUsageWindow } => Boolean(item));

  return (
    <section aria-label={t("aiChat.codexUsage")} className="ai-usage-panel">
      <div className="ai-usage-heading">
        <span className="ai-usage-gauge" aria-hidden="true" />
        <span>{t("aiChat.remainingUsage")}</span>
      </div>
      {windows.length > 0 ? (
        <div className="ai-usage-rows">
          {windows.map((item) => (
            <div className="ai-usage-row" key={item.id}>
              <span className="ai-usage-window">{item.label}</span>
              <span className="ai-usage-percent">{item.window.remainingPercent}%</span>
              <span className="ai-usage-reset">{formatUsageReset(item.window.resetsAt, t)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="ai-usage-empty">{t("aiChat.usageUnavailable")}</p>
      )}
    </section>
  );
}

function OpenAIAPIUsagePanel({ t }: { t: Translator }): ReactElement {
  return (
    <section aria-label={t("aiChat.openAIUsage")} className="ai-usage-panel">
      <div className="ai-usage-heading">
        <span className="ai-usage-gauge" aria-hidden="true" />
        <span>{t("aiChat.openAIUsage")}</span>
      </div>
      <p className="ai-usage-empty">{t("aiChat.openAIUsageHint")}</p>
    </section>
  );
}

function formatUsageWindowLabel(window: AIWorkspaceUsageWindow, t: Translator): string {
  const mins = window.windowDurationMins;
  if (!mins) return t("aiChat.usageNow");
  if (mins === 10080) return t("aiChat.usageWeek");
  if (mins % 1440 === 0) return t("aiChat.usageDay", { count: mins / 1440 });
  if (mins % 60 === 0) return t("aiChat.usageHour", { count: mins / 60 });

  return t("aiChat.usageMinute", { count: mins });
}

function formatUsageReset(resetsAt: string | null, t: Translator): string {
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

  return t("aiChat.resetDate", { day: resetDate.getDate(), month: resetDate.getMonth() + 1 });
}
