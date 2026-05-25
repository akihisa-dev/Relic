import type { ReactElement } from "react";

import { useT } from "../i18n";
import { useToolsPanelState } from "../hooks/useToolsPanelState";
import {
  MergeFilesToolSection,
  SplitFileToolSection,
  TitleListToolSection,
  TocToolSection
} from "./ToolsPanelSections";

export function ToolsPanel({ workspacePath }: { workspacePath: string | null }): ReactElement {
  const t = useT();
  const {
    handleGenerateTitleList,
    handleGenerateToc,
    handleMergeFiles,
    handleSplitFile,
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
  } = useToolsPanelState(workspacePath, t);

  return (
    <div className="settings-page tools-settings-page">
      <header className="settings-page-header">
        <p className="settings-page-kicker">{t("nav.tools")}</p>
        <h2>{t("tools.tools")}</h2>
      </header>
      {!workspacePath ? (
        <div className="empty-note">{t("tools.workspaceRequired")}</div>
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
          <MergeFilesToolSection
            draft={mergeDraft}
            onFilterTypeChange={setMergeFilterType}
            onMerge={handleMergeFiles}
            onSortByChange={setMergeSortBy}
            onUpdate={setMergeDraftField}
            status={mergeStatus}
          />
          <SplitFileToolSection
            draft={splitDraft}
            onSplit={handleSplitFile}
            onSplitLevelChange={setSplitLevel}
            onUpdate={setSplitDraftField}
            status={splitStatus}
          />
        </>
      )}
    </div>
  );
}
