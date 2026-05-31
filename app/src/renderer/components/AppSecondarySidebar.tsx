import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";

import type { AIWorkspaceMessagePreview, AIWorkspaceState } from "../../shared/ipc";
import type { SecondarySidebarView } from "../store/uiStore";
import { AIWorkspacePanel } from "./AIWorkspacePanel";

interface AppSecondarySidebarProps {
  aiWorkspaceState: AIWorkspaceState | null;
  aiWorkspaceMessagePreview: AIWorkspaceMessagePreview | null;
  isAIWorkspaceLoading: boolean;
  isAIWorkspaceSending: boolean;
  isOpen: boolean;
  isResizing: boolean;
  onAIWorkspaceApplyOperations: (operationIds?: string[]) => void;
  onAIWorkspaceCancelMessagePreview: () => void;
  onAIWorkspaceCancelSending: () => void;
  onAIWorkspaceClearData: () => void;
  onAIWorkspaceConfirmMessagePreview: () => void;
  onAIWorkspaceDiscardOperations: (operationIds?: string[]) => void;
  onAIWorkspaceRebuildIndex: () => void;
  onAIWorkspaceSendMessage: (message: string) => void;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onResizeStart: (event: ReactMouseEvent) => void;
  view: SecondarySidebarView;
  width: number;
  workspaceName?: string | null;
}

export function AppSecondarySidebar({
  aiWorkspaceState,
  aiWorkspaceMessagePreview,
  isAIWorkspaceLoading,
  isAIWorkspaceSending,
  isOpen,
  isResizing,
  onAIWorkspaceApplyOperations,
  onAIWorkspaceCancelMessagePreview,
  onAIWorkspaceCancelSending,
  onAIWorkspaceClearData,
  onAIWorkspaceConfirmMessagePreview,
  onAIWorkspaceDiscardOperations,
  onAIWorkspaceRebuildIndex,
  onAIWorkspaceSendMessage,
  onClose,
  onOpenFile,
  onResizeStart,
  view,
  width,
  workspaceName
}: AppSecondarySidebarProps): ReactElement {
  const shouldShowAIChat = isOpen && view === "ai-chat";

  return (
    <aside
      aria-hidden={!isOpen}
      aria-label="AIチャット"
      className={`secondary-sidebar${isOpen ? "" : " secondary-sidebar--closed"}${isResizing ? " secondary-sidebar--resizing" : ""}`}
      style={{ flexBasis: isOpen ? width : 0, width: isOpen ? width : 0 }}
    >
      <button
        aria-label="AIチャットの幅を変更"
        className={`secondary-sidebar-resize-handle${isResizing ? " secondary-sidebar-resize-handle--active" : ""}`}
        onMouseDown={onResizeStart}
        type="button"
      />
      <header className="secondary-sidebar-header">
        <span>AIチャット</span>
        <button aria-label="AIチャットを閉じる" className="secondary-sidebar-close-button" onClick={onClose} type="button">
          ×
        </button>
      </header>
      <div className="secondary-sidebar-body">
        {shouldShowAIChat ? (
          <AIWorkspacePanel
            isLoading={isAIWorkspaceLoading}
            isSending={isAIWorkspaceSending}
            messagePreview={aiWorkspaceMessagePreview}
            onClearData={onAIWorkspaceClearData}
            onApplyOperations={onAIWorkspaceApplyOperations}
            onCancelMessagePreview={onAIWorkspaceCancelMessagePreview}
            onCancelSending={onAIWorkspaceCancelSending}
            onConfirmMessagePreview={onAIWorkspaceConfirmMessagePreview}
            onDiscardOperations={onAIWorkspaceDiscardOperations}
            onOpenFile={onOpenFile}
            onRebuildIndex={onAIWorkspaceRebuildIndex}
            onSendMessage={onAIWorkspaceSendMessage}
            state={aiWorkspaceState}
            workspaceName={workspaceName}
          />
        ) : null}
      </div>
    </aside>
  );
}
