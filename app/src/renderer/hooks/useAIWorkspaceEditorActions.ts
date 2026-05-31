import { useMemo } from "react";

import type { FileTab } from "../store/editorStore";

interface UseAIWorkspaceEditorActionsInput {
  activeFileTab: FileTab | null;
  applyAIWorkspaceOperations: (dirtyFilePaths: string[], operationIds?: string[]) => Promise<void>;
  cancelAIWorkspaceMessage: () => void;
  clearAIWorkspaceData: () => Promise<void>;
  confirmAIWorkspaceMessage: (dirtyFilePaths: string[], activeFilePath: string | null, activeFileContent: string | null) => Promise<void>;
  dirtyMarkdownPaths: string[];
  discardAIWorkspaceOperations: (operationIds?: string[]) => Promise<void>;
  rebuildAIWorkspaceIndex: () => Promise<void>;
  sendAIWorkspaceMessage: (message: string, dirtyFilePaths: string[], activeFilePath: string | null, activeFileContent: string | null) => Promise<void>;
}

export function useAIWorkspaceEditorActions({
  activeFileTab,
  applyAIWorkspaceOperations,
  cancelAIWorkspaceMessage,
  clearAIWorkspaceData,
  confirmAIWorkspaceMessage,
  dirtyMarkdownPaths,
  discardAIWorkspaceOperations,
  rebuildAIWorkspaceIndex,
  sendAIWorkspaceMessage
}: UseAIWorkspaceEditorActionsInput): {
  onAIWorkspaceApplyOperations: (operationIds?: string[]) => void;
  onAIWorkspaceCancelMessagePreview: () => void;
  onAIWorkspaceCancelSending: () => void;
  onAIWorkspaceClearData: () => void;
  onAIWorkspaceConfirmMessagePreview: () => void;
  onAIWorkspaceDiscardOperations: (operationIds?: string[]) => void;
  onAIWorkspaceRebuildIndex: () => void;
  onAIWorkspaceSendMessage: (message: string) => void;
} {
  const activeFilePath = activeFileTab?.path ?? null;
  const activeFileContent = activeFileTab?.content ?? null;

  return useMemo(() => ({
    onAIWorkspaceApplyOperations: (operationIds?: string[]) => {
      void applyAIWorkspaceOperations(dirtyMarkdownPaths, operationIds);
    },
    onAIWorkspaceCancelMessagePreview: cancelAIWorkspaceMessage,
    onAIWorkspaceCancelSending: () => {
      void cancelAIWorkspaceMessage();
    },
    onAIWorkspaceClearData: () => {
      void clearAIWorkspaceData();
    },
    onAIWorkspaceConfirmMessagePreview: () => {
      void confirmAIWorkspaceMessage(dirtyMarkdownPaths, activeFilePath, activeFileContent);
    },
    onAIWorkspaceDiscardOperations: (operationIds?: string[]) => {
      void discardAIWorkspaceOperations(operationIds);
    },
    onAIWorkspaceRebuildIndex: () => {
      void rebuildAIWorkspaceIndex();
    },
    onAIWorkspaceSendMessage: (message: string) => {
      void sendAIWorkspaceMessage(message, dirtyMarkdownPaths, activeFilePath, activeFileContent);
    }
  }), [
    activeFileContent,
    activeFilePath,
    applyAIWorkspaceOperations,
    cancelAIWorkspaceMessage,
    clearAIWorkspaceData,
    confirmAIWorkspaceMessage,
    dirtyMarkdownPaths,
    discardAIWorkspaceOperations,
    rebuildAIWorkspaceIndex,
    sendAIWorkspaceMessage
  ]);
}
