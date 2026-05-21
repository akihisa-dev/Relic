import type { ReactElement } from "react";

import { useT } from "../i18n";
import { useToolsSidebarState } from "../hooks/useToolsSidebarState";
import {
  MergeCardsToolSection,
  SplitCardToolSection,
  TitleListToolSection,
  TocToolSection
} from "./ToolsSidebarSections";

export function ToolsSidebar({ cardbookPath }: { cardbookPath: string | null }): ReactElement {
  const t = useT();
  const {
    handleGenerateTitleList,
    handleGenerateToc,
    handleMergeCards,
    handleSplitCard,
    mergeDraft,
    mergeStatus,
    setMergeDraftField,
    setMergeFilterType,
    setMergeSortBy,
    setSplitDraftField,
    setSplitLevel,
    setTitleListDraftField,
    setTitleListSortBy,
    setTocDraftField,
    splitDraft,
    splitStatus,
    titleListDraft,
    titleListStatus,
    tocDraft,
    tocStatus
  } = useToolsSidebarState(cardbookPath, t);

  return (
    <div className="settings-page tools-settings-page">
      <header className="settings-page-header">
        <p className="settings-page-kicker">{t("nav.tools")}</p>
        <h2>{t("tools.tools")}</h2>
      </header>
      {!cardbookPath ? (
        <div className="empty-note">{t("tools.cardbookRequired")}</div>
      ) : (
        <>
          <TitleListToolSection
            draft={titleListDraft}
            onGenerate={handleGenerateTitleList}
            onSortByChange={setTitleListSortBy}
            onUpdate={setTitleListDraftField}
            status={titleListStatus}
          />
          <TocToolSection
            draft={tocDraft}
            onGenerate={handleGenerateToc}
            onUpdate={setTocDraftField}
            status={tocStatus}
          />
          <MergeCardsToolSection
            draft={mergeDraft}
            onFilterTypeChange={setMergeFilterType}
            onMerge={handleMergeCards}
            onSortByChange={setMergeSortBy}
            onUpdate={setMergeDraftField}
            status={mergeStatus}
          />
          <SplitCardToolSection
            draft={splitDraft}
            onSplit={handleSplitCard}
            onSplitLevelChange={setSplitLevel}
            onUpdate={setSplitDraftField}
            status={splitStatus}
          />
        </>
      )}
    </div>
  );
}
