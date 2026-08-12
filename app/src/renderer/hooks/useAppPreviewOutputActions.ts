import { relicClient } from "../relicClient";
import { useCallback } from "react";

import type { FileTab } from "../store/editorStore";
import { buildPreviewOutputHtml } from "../outputHtml";
import type { Translator } from "../i18nModel";
import type { IsCurrentRequest } from "./useAsyncRequestGuard";

interface UseAppPreviewOutputActionsInput {
  activeFileTab: FileTab | null;
  setWorkspaceError: (message: string | null) => void;
  showToast: (text: string, type?: "error" | "info") => void;
  t: Translator;
  beginWorkspaceRequest?: () => IsCurrentRequest;
  workspacePath?: string | null;
  workspaceRevision?: number;
}

export function useAppPreviewOutputActions({
  activeFileTab,
  setWorkspaceError,
  showToast,
  t,
  beginWorkspaceRequest = () => () => true,
  workspacePath,
  workspaceRevision = 0
}: UseAppPreviewOutputActionsInput): {
  handleSavePreviewAsPdf: (tab?: FileTab) => void;
} {
  const buildPreviewOutput = useCallback(async (tab?: FileTab) => {
    const outputTab = tab ?? activeFileTab;
    if (!outputTab) return null;

    return await buildPreviewOutputHtml({
      content: outputTab.content,
      fileName: outputTab.name,
      path: outputTab.path,
      t,
      title: outputTab.name,
      workspacePath,
      workspaceRevision
    });
  }, [activeFileTab, t, workspacePath, workspaceRevision]);

  const handleSavePreviewAsPdf = useCallback((tab?: FileTab): void => {
    if (!relicClient.current) return;
    const isCurrentWorkspace = beginWorkspaceRequest();

    void buildPreviewOutput(tab).then(async (payload) => {
      if (!isCurrentWorkspace()) return;
      if (!payload) {
        setWorkspaceError(t("output.savePdfNoFile"));
        return;
      }

      // Workspace switching can finish while detached output HTML is rendering.
      // Do not send stale HTML to the main-process save dialog or surface its
      // result after the captured workspace has become inactive.
      if (!isCurrentWorkspace()) return;
      const result = await relicClient.current!.savePreviewAsPdf(payload);
      if (!isCurrentWorkspace()) return;
      if (!result.ok) {
        setWorkspaceError(result.error.message);
        return;
      }

      if (result.value.status === "saved") showToast(t("output.pdfSaved"), "info");
    }).catch((error) => {
      if (!isCurrentWorkspace()) return;
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    });
  }, [beginWorkspaceRequest, buildPreviewOutput, setWorkspaceError, showToast, t]);

  return {
    handleSavePreviewAsPdf
  };
}
