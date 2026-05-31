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
}

export function useAppPreviewOutputActions({
  activeFileTab,
  setWorkspaceError,
  showToast,
  t,
  workspacePath
}: UseAppPreviewOutputActionsInput): {
  handlePrintPreview: () => void;
  handleSavePreviewAsPdf: () => void;
} {
  const buildFocusedPreviewOutput = useCallback(async () => {
    if (!activeFileTab) return null;

    return await buildPreviewOutputHtml({
      content: activeFileTab.content,
      fileName: activeFileTab.name,
      path: activeFileTab.path,
      t,
      title: activeFileTab.name,
      workspacePath
    });
  }, [activeFileTab, t, workspacePath]);

  const handlePrintPreview = useCallback((): void => {
    if (!window.relic) return;

    void buildFocusedPreviewOutput().then(async (payload) => {
      if (!payload) {
        setWorkspaceError("印刷するMarkdownファイルを開いてください。");
        return;
      }

      const result = await window.relic!.printPreview({ html: payload.html, title: payload.title });
      if (!result.ok) {
        setWorkspaceError(result.error.message);
        return;
      }

      if (result.value.status === "printed") showToast(t("output.printed"), "info");
    }).catch((error) => {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    });
  }, [buildFocusedPreviewOutput, setWorkspaceError, showToast, t]);

  const handleSavePreviewAsPdf = useCallback((): void => {
    if (!window.relic) return;

    void buildFocusedPreviewOutput().then(async (payload) => {
      if (!payload) {
        setWorkspaceError("PDFとして保存するMarkdownファイルを開いてください。");
        return;
      }

      const result = await window.relic!.savePreviewAsPdf(payload);
      if (!result.ok) {
        setWorkspaceError(result.error.message);
        return;
      }

      if (result.value.status === "saved") showToast(t("output.pdfSaved"), "info");
    }).catch((error) => {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    });
  }, [buildFocusedPreviewOutput, setWorkspaceError, showToast, t]);

  return {
    handlePrintPreview,
    handleSavePreviewAsPdf
  };
}
