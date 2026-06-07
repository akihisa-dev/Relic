import { useState } from "react";

import type { MergeFilterType, MergeSortBy } from "../../shared/ipc";
import type { Translator } from "../i18nModel";
import {
  buildMergeFilesInput,
  buildTitleListInput,
  buildTocInput,
  createDefaultMergeFilesDraft,
  createDefaultTitleListDraft,
  createDefaultTocDraft,
  resultStatus,
  type MergeFilesDraft,
  type TitleListDraft,
  type TocDraft
} from "../toolsPanelModel";

type DraftSetter<T> = <K extends keyof T>(key: K, value: T[K]) => void;

export interface UseToolsPanelStateResult {
  handleGenerateTitleList: () => Promise<void>;
  handleGenerateToc: () => Promise<void>;
  handleMergeFiles: () => Promise<void>;
  mergeDraft: MergeFilesDraft;
  mergeStatus: string | null;
  setMergeDraftField: DraftSetter<MergeFilesDraft>;
  setMergeFilterType: (value: MergeFilterType) => void;
  setMergeSortBy: (value: MergeSortBy) => void;
  setTitleListDraftField: DraftSetter<TitleListDraft>;
  setTitleListSortBy: (value: "name" | "mtime") => void;
  setTocDraftField: DraftSetter<TocDraft>;
  titleListDraft: TitleListDraft;
  titleListStatus: string | null;
  tocDraft: TocDraft;
  tocStatus: string | null;
}

export function useToolsPanelState(workspacePath: string | null, t: Translator): UseToolsPanelStateResult {
  const [titleListDraft, setTitleListDraft] = useState(() => createDefaultTitleListDraft(t));
  const [titleListStatus, setTitleListStatus] = useState<string | null>(null);
  const [tocDraft, setTocDraft] = useState(() => createDefaultTocDraft(t));
  const [tocStatus, setTocStatus] = useState<string | null>(null);
  const [mergeDraft, setMergeDraft] = useState(() => createDefaultMergeFilesDraft(t));
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);

  const setTitleListDraftField: DraftSetter<TitleListDraft> = (key, value) => {
    setTitleListDraft((current) => ({ ...current, [key]: value }));
  };
  const setTocDraftField: DraftSetter<TocDraft> = (key, value) => {
    setTocDraft((current) => ({ ...current, [key]: value }));
  };
  const setMergeDraftField: DraftSetter<MergeFilesDraft> = (key, value) => {
    setMergeDraft((current) => ({ ...current, [key]: value }));
  };
  const handleGenerateTitleList = async (): Promise<void> => {
    if (!workspacePath) return;
    setTitleListStatus(t("common.running"));
    const result = await window.relic!.generateTitleList(buildTitleListInput(titleListDraft, t));
    setTitleListStatus(resultStatus(result, t, String));
  };

  const handleGenerateToc = async (): Promise<void> => {
    if (!workspacePath) return;
    setTocStatus(t("common.running"));
    const result = await window.relic!.generateTableOfContents(buildTocInput(tocDraft, t));
    setTocStatus(resultStatus(result, t, String));
  };

  const handleMergeFiles = async (): Promise<void> => {
    if (!workspacePath) return;
    setMergeStatus(t("tools.processing"));
    const result = await window.relic!.mergeFiles(buildMergeFilesInput(mergeDraft, t));
    setMergeStatus(resultStatus(result, t, String));
  };

  return {
    handleGenerateTitleList,
    handleGenerateToc,
    handleMergeFiles,
    mergeDraft,
    mergeStatus,
    setMergeDraftField,
    setMergeFilterType: (value) => setMergeDraftField("filterType", value),
    setMergeSortBy: (value) => setMergeDraftField("sortBy", value),
    setTitleListDraftField,
    setTitleListSortBy: (value) => setTitleListDraftField("sortBy", value),
    setTocDraftField,
    titleListDraft,
    titleListStatus,
    tocDraft,
    tocStatus
  };
}
