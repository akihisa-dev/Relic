import { relicClient } from "../relicClient";
import { useState } from "react";

import type { Translator } from "../i18nModel";
import {
  buildMergeFilesInput,
  buildTagIndexInput,
  buildTitleListInput,
  buildTocInput,
  createDefaultMergeFilesDraft,
  createDefaultTagIndexDraft,
  createDefaultTitleListDraft,
  createDefaultTocDraft,
  resultStatus
} from "../toolsPanelModel";

export type ToolActionId = "titleList" | "toc" | "tagIndex" | "mergeFiles";

export interface UseToolsPanelStateResult {
  handleGenerateTitleList: () => Promise<void>;
  handleGenerateTagIndex: () => Promise<void>;
  handleGenerateToc: () => Promise<void>;
  handleMergeFiles: () => Promise<void>;
  latestStatus: string | null;
  runningTool: ToolActionId | null;
}

export function useToolsPanelState(workspacePath: string | null, t: Translator): UseToolsPanelStateResult {
  const [latestStatus, setLatestStatus] = useState<string | null>(null);
  const [runningTool, setRunningTool] = useState<ToolActionId | null>(null);

  const runTool = async (toolId: ToolActionId, action: () => Promise<string>): Promise<void> => {
    if (!workspacePath) return;

    setRunningTool(toolId);
    setLatestStatus(t("common.running"));

    try {
      setLatestStatus(await action());
    } finally {
      setRunningTool(null);
    }
  };

  const handleGenerateTitleList = async (): Promise<void> => {
    await runTool("titleList", async () => {
      const result = await relicClient.current!.generateTitleList(buildTitleListInput(createDefaultTitleListDraft(t), t));
      return resultStatus(result, t, String);
    });
  };

  const handleGenerateToc = async (): Promise<void> => {
    await runTool("toc", async () => {
      const result = await relicClient.current!.generateTableOfContents(buildTocInput(createDefaultTocDraft(t), t));
      return resultStatus(result, t, String);
    });
  };

  const handleGenerateTagIndex = async (): Promise<void> => {
    await runTool("tagIndex", async () => {
      const result = await relicClient.current!.generateTagIndex(buildTagIndexInput(createDefaultTagIndexDraft(t), t));
      return resultStatus(result, t, String);
    });
  };

  const handleMergeFiles = async (): Promise<void> => {
    await runTool("mergeFiles", async () => {
      const result = await relicClient.current!.mergeFiles(buildMergeFilesInput(createDefaultMergeFilesDraft(t), t));
      return resultStatus(result, t, String);
    });
  };

  return {
    handleGenerateTitleList,
    handleGenerateTagIndex,
    handleGenerateToc,
    handleMergeFiles,
    latestStatus,
    runningTool
  };
}
