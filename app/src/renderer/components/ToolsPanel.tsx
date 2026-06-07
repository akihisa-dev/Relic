import type { ReactElement } from "react";

import { useT } from "../i18n";
import { useToolsPanelState } from "../hooks/useToolsPanelState";
import {
  MergeFilesToolSection,
  TagIndexToolSection,
  TitleListToolSection,
  TocToolSection
} from "./ToolsPanelSections";

export function ToolsPanel({ workspacePath }: { workspacePath: string | null }): ReactElement {
  const t = useT();
  const {
    handleGenerateTitleList,
    handleGenerateTagIndex,
    handleGenerateToc,
    handleMergeFiles,
    mergeDraft,
    mergeStatus,
    setMergeDraftField,
    setMergeFilterType,
    setMergeSortBy,
    setTagIndexDraftField,
    setTagIndexSortBy,
    setTitleListDraftField,
    setTitleListSortBy,
    setTocDraftField,
    tagIndexDraft,
    tagIndexStatus,
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
          <TagIndexToolSection
            draft={tagIndexDraft}
            onGenerate={handleGenerateTagIndex}
            onSortByChange={setTagIndexSortBy}
            onUpdate={setTagIndexDraftField}
            status={tagIndexStatus}
          />
          <MergeFilesToolSection
            draft={mergeDraft}
            onFilterTypeChange={setMergeFilterType}
            onMerge={handleMergeFiles}
            onSortByChange={setMergeSortBy}
            onUpdate={setMergeDraftField}
            status={mergeStatus}
          />
        </>
      )}
    </div>
  );
}
