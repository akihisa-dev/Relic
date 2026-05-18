import { useState } from "react";

import type { MergeFilterType, MergeSortBy, SplitHeadingLevel } from "../../shared/ipc";
import type { Translator } from "../i18n";
import {
  buildMergeFilesInput,
  buildSplitFileInput,
  buildTitleListInput,
  buildTocInput,
  createDefaultMergeFilesDraft,
  createDefaultSplitFileDraft,
  createDefaultTitleListDraft,
  createDefaultTocDraft,
  resultStatus,
  splitResultStatus,
  type MergeFilesDraft,
  type SplitFileDraft,
  type TitleListDraft,
  type TocDraft
} from "../toolsSidebarModel";

type DraftSetter<T> = <K extends keyof T>(key: K, value: T[K]) => void;

export interface UseToolsSidebarStateResult {
  handleGenerateTitleList: () => Promise<void>;
  handleGenerateToc: () => Promise<void>;
  handleMergeFiles: () => Promise<void>;
  handleSplitFile: () => Promise<void>;
  mergeDraft: MergeFilesDraft;
  mergeStatus: string | null;
  setMergeDraftField: DraftSetter<MergeFilesDraft>;
  setMergeFilterType: (value: MergeFilterType) => void;
  setMergeSortBy: (value: MergeSortBy) => void;
  setSplitDraftField: DraftSetter<SplitFileDraft>;
  setSplitLevel: (value: SplitHeadingLevel) => void;
  setTitleListDraftField: DraftSetter<TitleListDraft>;
  setTitleListSortBy: (value: "name" | "mtime") => void;
  setTocDraftField: DraftSetter<TocDraft>;
  splitDraft: SplitFileDraft;
  splitStatus: string | null;
  titleListDraft: TitleListDraft;
  titleListStatus: string | null;
  tocDraft: TocDraft;
  tocStatus: string | null;
}

export function useToolsSidebarState(workspacePath: string | null, t: Translator): UseToolsSidebarStateResult {
  const [titleListDraft, setTitleListDraft] = useState(() => createDefaultTitleListDraft(t));
  const [titleListStatus, setTitleListStatus] = useState<string | null>(null);
  const [tocDraft, setTocDraft] = useState(() => createDefaultTocDraft(t));
  const [tocStatus, setTocStatus] = useState<string | null>(null);
  const [mergeDraft, setMergeDraft] = useState(() => createDefaultMergeFilesDraft(t));
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);
  const [splitDraft, setSplitDraft] = useState(createDefaultSplitFileDraft);
  const [splitStatus, setSplitStatus] = useState<string | null>(null);

  const setTitleListDraftField: DraftSetter<TitleListDraft> = (key, value) => {
    setTitleListDraft((current) => ({ ...current, [key]: value }));
  };
  const setTocDraftField: DraftSetter<TocDraft> = (key, value) => {
    setTocDraft((current) => ({ ...current, [key]: value }));
  };
  const setMergeDraftField: DraftSetter<MergeFilesDraft> = (key, value) => {
    setMergeDraft((current) => ({ ...current, [key]: value }));
  };
  const setSplitDraftField: DraftSetter<SplitFileDraft> = (key, value) => {
    setSplitDraft((current) => ({ ...current, [key]: value }));
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

  const handleSplitFile = async (): Promise<void> => {
    if (!workspacePath || !splitDraft.sourcePath) return;
    setSplitStatus(t("tools.processing"));
    const result = await window.relic!.splitFileByHeading(buildSplitFileInput(splitDraft));
    setSplitStatus(splitResultStatus(result, t));
  };

  return {
    handleGenerateTitleList,
    handleGenerateToc,
    handleMergeFiles,
    handleSplitFile,
    mergeDraft,
    mergeStatus,
    setMergeDraftField,
    setMergeFilterType: (value) => setMergeDraftField("filterType", value),
    setMergeSortBy: (value) => setMergeDraftField("sortBy", value),
    setSplitDraftField,
    setSplitLevel: (value) => setSplitDraftField("headingLevel", value),
    setTitleListDraftField,
    setTitleListSortBy: (value) => setTitleListDraftField("sortBy", value),
    setTocDraftField,
    splitDraft,
    splitStatus,
    titleListDraft,
    titleListStatus,
    tocDraft,
    tocStatus
  };
}
