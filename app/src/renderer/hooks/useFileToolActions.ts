import { useCallback, useRef, useState } from "react";

import type { ToolTarget } from "../../shared/ipc";
import type { Translator } from "../i18nModel";
import { relicClient } from "../relicClient";
import {
  buildMergeFilesInput,
  buildTagIndexInput,
  buildTitleListInput,
  buildTocInput,
  createDefaultMergeFilesDraft,
  createDefaultTagIndexDraft,
  createDefaultTitleListDraft,
  createDefaultTocDraft
} from "../toolsPanelModel";
import type { FileToolActionId } from "../fileTreeTypes";

interface UseFileToolActionsInput {
  onOpenFile: (path: string) => void;
  onShowToast: (text: string, type?: "error" | "info") => void;
  t: Translator;
}

export function useFileToolActions({ onOpenFile, onShowToast, t }: UseFileToolActionsInput): {
  onRunFileTool: (toolId: FileToolActionId, target: ToolTarget) => void;
  runningFileTool: FileToolActionId | null;
} {
  const [runningFileTool, setRunningFileTool] = useState<FileToolActionId | null>(null);
  const callbacksRef = useRef({ onOpenFile, onShowToast, t });
  const runningRef = useRef(false);
  callbacksRef.current = { onOpenFile, onShowToast, t };

  const onRunFileTool = useCallback((toolId: FileToolActionId, target: ToolTarget): void => {
    if (runningRef.current || !relicClient.current) return;
    const callbacks = callbacksRef.current;
    runningRef.current = true;
    setRunningFileTool(toolId);

    const execute = async () => {
      if (toolId === "titleList") {
        return relicClient.current!.generateTitleList(buildTitleListInput(createDefaultTitleListDraft(callbacks.t), callbacks.t, target));
      }
      if (toolId === "toc") {
        return relicClient.current!.generateTableOfContents(buildTocInput(createDefaultTocDraft(callbacks.t), callbacks.t, target));
      }
      if (toolId === "tagIndex") {
        return relicClient.current!.generateTagIndex(buildTagIndexInput(createDefaultTagIndexDraft(callbacks.t), callbacks.t, target));
      }
      return relicClient.current!.mergeFiles(buildMergeFilesInput(createDefaultMergeFilesDraft(callbacks.t), callbacks.t, target));
    };

    void execute()
      .then((result) => {
        if (!result.ok) {
          callbacks.onShowToast(result.error.message, "error");
          return;
        }
        callbacks.onShowToast(callbacks.t("tools.createdFile", { path: result.value }), "info");
        callbacks.onOpenFile(result.value);
      })
      .catch(() => callbacks.onShowToast(callbacks.t("tools.unexpectedError"), "error"))
      .finally(() => {
        runningRef.current = false;
        setRunningFileTool(null);
      });
  }, []);

  return { onRunFileTool, runningFileTool };
}
