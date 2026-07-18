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
  const runningRef = useRef(false);

  const onRunFileTool = useCallback((toolId: FileToolActionId, target: ToolTarget): void => {
    if (runningRef.current || !relicClient.current) return;
    runningRef.current = true;
    setRunningFileTool(toolId);

    const execute = async () => {
      if (toolId === "titleList") {
        return relicClient.current!.generateTitleList({ ...buildTitleListInput(createDefaultTitleListDraft(t), t), target });
      }
      if (toolId === "toc") {
        return relicClient.current!.generateTableOfContents({ ...buildTocInput(createDefaultTocDraft(t), t), target });
      }
      if (toolId === "tagIndex") {
        return relicClient.current!.generateTagIndex({ ...buildTagIndexInput(createDefaultTagIndexDraft(t), t), target });
      }
      return relicClient.current!.mergeFiles({ ...buildMergeFilesInput(createDefaultMergeFilesDraft(t), t), target });
    };

    void execute()
      .then((result) => {
        if (!result.ok) {
          onShowToast(result.error.message, "error");
          return;
        }
        onShowToast(t("tools.createdFile", { path: result.value }), "info");
        onOpenFile(result.value);
      })
      .catch(() => onShowToast(t("tools.unexpectedError"), "error"))
      .finally(() => {
        runningRef.current = false;
        setRunningFileTool(null);
      });
  }, [onOpenFile, onShowToast, t]);

  return { onRunFileTool, runningFileTool };
}
