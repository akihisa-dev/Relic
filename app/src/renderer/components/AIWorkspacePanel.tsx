import { useLayoutEffect, useRef, useState, type ReactElement } from "react";

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
  isSending,
  onSendMessage,
  state
}: AIWorkspacePanelProps): ReactElement {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const history = state?.history ?? [];
  const sendCurrentMessage = (): void => {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;
    onSendMessage(trimmed);
    setMessage("");
  };

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [message]);

  return (
    <div className="ai-workspace-panel">
      <div className="ai-workspace-messages" aria-live="polite">
        {history.map((item) => (
          <article className={`ai-workspace-message ai-workspace-message--${item.role}`} key={item.id}>
            <p>{item.content}</p>
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
        <button aria-label="送信" disabled={isSending || !message.trim()} type="submit">
          <span aria-hidden="true">↑</span>
        </button>
      </form>
    </div>
  );
}
