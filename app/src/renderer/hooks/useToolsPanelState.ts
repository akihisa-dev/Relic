import { useState } from "react";

import type { MergeFilterType, MergeSortBy } from "../../shared/ipc";
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
  resultStatus,
  type MergeFilesDraft,
  type TagIndexDraft,
  type TitleListDraft,
  type TocDraft
} from "../toolsPanelModel";

type DraftSetter<T> = <K extends keyof T>(key: K, value: T[K]) => void;

export interface UseToolsPanelStateResult {
  handleGenerateTitleList: () => Promise<void>;
  handleGenerateTagIndex: () => Promise<void>;
  handleGenerateToc: () => Promise<void>;
  handleMergeFiles: () => Promise<void>;
  mergeDraft: MergeFilesDraft;
  mergeStatus: string | null;
  setMergeDraftField: DraftSetter<MergeFilesDraft>;
  setMergeFilterType: (value: MergeFilterType) => void;
  setMergeSortBy: (value: MergeSortBy) => void;
  setTagIndexDraftField: DraftSetter<TagIndexDraft>;
  setTagIndexSortBy: (value: "name" | "mtime") => void;
  setTitleListDraftField: DraftSetter<TitleListDraft>;
  setTitleListSortBy: (value: "name" | "mtime") => void;
  setTocDraftField: DraftSetter<TocDraft>;
  tagIndexDraft: TagIndexDraft;
  tagIndexStatus: string | null;
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
  const [tagIndexDraft, setTagIndexDraft] = useState(() => createDefaultTagIndexDraft(t));
  const [tagIndexStatus, setTagIndexStatus] = useState<string | null>(null);
  const [mergeDraft, setMergeDraft] = useState(() => createDefaultMergeFilesDraft(t));
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);

  const setTitleListDraftField: DraftSetter<TitleListDraft> = (key, value) => {
    setTitleListDraft((current) => ({ ...current, [key]: value }));
  };
  const setTocDraftField: DraftSetter<TocDraft> = (key, value) => {
    setTocDraft((current) => ({ ...current, [key]: value }));
  };
  const setTagIndexDraftField: DraftSetter<TagIndexDraft> = (key, value) => {
    setTagIndexDraft((current) => ({ ...current, [key]: value }));
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

  const handleGenerateTagIndex = async (): Promise<void> => {
    if (!workspacePath) return;
    setTagIndexStatus(t("common.running"));
    const result = await window.relic!.generateTagIndex(buildTagIndexInput(tagIndexDraft, t));
    setTagIndexStatus(resultStatus(result, t, String));
  };

  const handleMergeFiles = async (): Promise<void> => {
    if (!workspacePath) return;
    setMergeStatus(t("tools.processing"));
    const result = await window.relic!.mergeFiles(buildMergeFilesInput(mergeDraft, t));
    setMergeStatus(resultStatus(result, t, String));
  };

  return {
    handleGenerateTitleList,
    handleGenerateTagIndex,
    handleGenerateToc,
    handleMergeFiles,
    mergeDraft,
    mergeStatus,
    setMergeDraftField,
    setMergeFilterType: (value) => setMergeDraftField("filterType", value),
    setMergeSortBy: (value) => setMergeDraftField("sortBy", value),
    setTagIndexDraftField,
    setTagIndexSortBy: (value) => setTagIndexDraftField("sortBy", value),
    setTitleListDraftField,
    setTitleListSortBy: (value) => setTitleListDraftField("sortBy", value),
    setTocDraftField,
    tagIndexDraft,
    tagIndexStatus,
    titleListDraft,
    titleListStatus,
    tocDraft,
    tocStatus
  };
}
