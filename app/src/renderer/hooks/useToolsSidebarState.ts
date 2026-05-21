import { useState } from "react";

import type { MergeFilterType, MergeSortBy, SplitHeadingLevel } from "../../shared/ipc";
import type { Translator } from "../i18n";
import {
  buildMergeCardsInput,
  buildSplitCardInput,
  buildTitleListInput,
  buildTocInput,
  createDefaultMergeCardsDraft,
  createDefaultSplitCardDraft,
  createDefaultTitleListDraft,
  createDefaultTocDraft,
  resultStatus,
  splitResultStatus,
  type MergeCardsDraft,
  type SplitCardDraft,
  type TitleListDraft,
  type TocDraft
} from "../toolsSidebarModel";

type DraftSetter<T> = <K extends keyof T>(key: K, value: T[K]) => void;

export interface UseToolsSidebarStateResult {
  handleGenerateTitleList: () => Promise<void>;
  handleGenerateToc: () => Promise<void>;
  handleMergeCards: () => Promise<void>;
  handleSplitCard: () => Promise<void>;
  mergeDraft: MergeCardsDraft;
  mergeStatus: string | null;
  setMergeDraftField: DraftSetter<MergeCardsDraft>;
  setMergeFilterType: (value: MergeFilterType) => void;
  setMergeSortBy: (value: MergeSortBy) => void;
  setSplitDraftField: DraftSetter<SplitCardDraft>;
  setSplitLevel: (value: SplitHeadingLevel) => void;
  setTitleListDraftField: DraftSetter<TitleListDraft>;
  setTitleListSortBy: (value: "name" | "mtime") => void;
  setTocDraftField: DraftSetter<TocDraft>;
  splitDraft: SplitCardDraft;
  splitStatus: string | null;
  titleListDraft: TitleListDraft;
  titleListStatus: string | null;
  tocDraft: TocDraft;
  tocStatus: string | null;
}

export function useToolsSidebarState(cardbookPath: string | null, t: Translator): UseToolsSidebarStateResult {
  const [titleListDraft, setTitleListDraft] = useState(() => createDefaultTitleListDraft(t));
  const [titleListStatus, setTitleListStatus] = useState<string | null>(null);
  const [tocDraft, setTocDraft] = useState(() => createDefaultTocDraft(t));
  const [tocStatus, setTocStatus] = useState<string | null>(null);
  const [mergeDraft, setMergeDraft] = useState(() => createDefaultMergeCardsDraft(t));
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);
  const [splitDraft, setSplitDraft] = useState(createDefaultSplitCardDraft);
  const [splitStatus, setSplitStatus] = useState<string | null>(null);

  const setTitleListDraftField: DraftSetter<TitleListDraft> = (key, value) => {
    setTitleListDraft((current) => ({ ...current, [key]: value }));
  };
  const setTocDraftField: DraftSetter<TocDraft> = (key, value) => {
    setTocDraft((current) => ({ ...current, [key]: value }));
  };
  const setMergeDraftField: DraftSetter<MergeCardsDraft> = (key, value) => {
    setMergeDraft((current) => ({ ...current, [key]: value }));
  };
  const setSplitDraftField: DraftSetter<SplitCardDraft> = (key, value) => {
    setSplitDraft((current) => ({ ...current, [key]: value }));
  };

  const handleGenerateTitleList = async (): Promise<void> => {
    if (!cardbookPath) return;
    setTitleListStatus(t("common.running"));
    const result = await window.relic!.generateTitleList(buildTitleListInput(titleListDraft, t));
    setTitleListStatus(resultStatus(result, t, String));
  };

  const handleGenerateToc = async (): Promise<void> => {
    if (!cardbookPath) return;
    setTocStatus(t("common.running"));
    const result = await window.relic!.generateTableOfContents(buildTocInput(tocDraft, t));
    setTocStatus(resultStatus(result, t, String));
  };

  const handleMergeCards = async (): Promise<void> => {
    if (!cardbookPath) return;
    setMergeStatus(t("tools.processing"));
    const result = await window.relic!.mergeCards(buildMergeCardsInput(mergeDraft, t));
    setMergeStatus(resultStatus(result, t, String));
  };

  const handleSplitCard = async (): Promise<void> => {
    if (!cardbookPath || !splitDraft.sourcePath) return;
    setSplitStatus(t("tools.processing"));
    const result = await window.relic!.splitCardByHeading(buildSplitCardInput(splitDraft));
    setSplitStatus(splitResultStatus(result, t));
  };

  return {
    handleGenerateTitleList,
    handleGenerateToc,
    handleMergeCards,
    handleSplitCard,
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
