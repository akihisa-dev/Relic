import { relicClient } from "../relicClient";
import { useCallback } from "react";

import type { FileTab } from "../store/editorStore";
import { buildPreviewOutputHtml } from "../outputHtml";
import type { Translator } from "../i18nModel";

interface UseAppPreviewOutputActionsInput {
  activeFileTab: FileTab | null;
  setWorkspaceError: (message: string | null) => void;
  showToast: (text: string, type?: "error" | "info") => void;
  t: Translator;
  workspacePath?: string | null;
  workspaceRevision?: number;
}

export function useAppPreviewOutputActions({
  activeFileTab,
  setWorkspaceError,
  showToast,
  t,
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

    void buildPreviewOutput(tab).then(async (payload) => {
      if (!payload) {
        setWorkspaceError(t("output.savePdfNoFile"));
        return;
      }

      const result = await relicClient.current!.savePreviewAsPdf(payload);
      if (!result.ok) {
        setWorkspaceError(result.error.message);
        return;
      }

      if (result.value.status === "saved") showToast(t("output.pdfSaved"), "info");
    }).catch((error) => {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    });
  }, [buildPreviewOutput, setWorkspaceError, showToast, t]);

  return {
    handleSavePreviewAsPdf
  };
}
