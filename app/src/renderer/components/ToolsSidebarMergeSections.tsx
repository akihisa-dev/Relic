import type { ReactElement } from "react";

import type { MergeFilterType, MergeSortBy, SplitHeadingLevel } from "../../shared/ipc";
import { useT } from "../i18n";
import type { MergeCardsDraft, SplitCardDraft } from "../toolsSidebarModel";
import { ToolStatus } from "./ToolStatus";

export function MergeCardsToolSection({
  draft,
  onMerge,
  onFilterTypeChange,
  onSortByChange,
  onUpdate,
  status
}: {
  draft: MergeCardsDraft;
  onMerge: () => void;
  onFilterTypeChange: (value: MergeFilterType) => void;
  onSortByChange: (value: MergeSortBy) => void;
  onUpdate: <K extends keyof MergeCardsDraft>(key: K, value: MergeCardsDraft[K]) => void;
  status: string | null;
}): ReactElement {
  const t = useT();

  return (
    <section className="settings-group tools-settings-group">
      <div className="links-panel-subheading">{t("tools.merge")}</div>
      <div className="search-block">
        <label className="setting-row">
          <span>{t("tools.filter")}</span>
          <select
            onChange={(e) => onFilterTypeChange(e.target.value as MergeFilterType)}
            value={draft.filterType}
          >
            <option value="all">{t("tools.filterAll")}</option>
            <option value="cardFolder">{t("tools.filterCardFolder")}</option>
            <option value="tag">{t("tools.filterTag")}</option>
            <option value="frontmatter">{t("tools.filterFrontmatter")}</option>
          </select>
        </label>
        {draft.filterType === "frontmatter" ? (
          <>
            <label className="setting-row">
              <span>{t("tools.frontmatterField")}</span>
              <input
                onChange={(e) => onUpdate("frontmatterField", e.target.value)}
                placeholder={t("tools.placeholderFrontmatterFieldExample")}
                type="text"
                value={draft.frontmatterField}
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.frontmatterValue")}</span>
              <input
                onChange={(e) => onUpdate("filterValue", e.target.value)}
                placeholder={t("tools.placeholderFrontmatterValueExample")}
                type="text"
                value={draft.filterValue}
              />
            </label>
          </>
        ) : draft.filterType !== "all" && (
          <label className="setting-row">
            <span>{draft.filterType === "cardFolder" ? t("tools.cardFolderName") : t("tools.tagName")}</span>
            <input
              onChange={(e) => onUpdate("filterValue", e.target.value)}
              placeholder={draft.filterType === "cardFolder" ? t("tools.placeholderCardFolderExample") : t("tools.placeholderTagExample")}
              type="text"
              value={draft.filterValue}
            />
          </label>
        )}
        <label className="setting-row">
          <span>{t("tools.sort")}</span>
          <select
            onChange={(e) => onSortByChange(e.target.value as MergeSortBy)}
            value={draft.sortBy}
          >
            <option value="name">{t("tools.sortName")}</option>
            <option value="mtime">{t("tools.sortMtime")}</option>
            <option value="ctime">{t("tools.sortCtime")}</option>
          </select>
        </label>
        <label className="setting-row">
          <span>{t("tools.cardNameHeading")}</span>
          <input
            checked={draft.insertCardNameHeading}
            onChange={(e) => onUpdate("insertCardNameHeading", e.target.checked)}
            type="checkbox"
          />
        </label>
        <label className="setting-row">
          <span>{t("tools.outputCardFolder")}</span>
          <input
            onChange={(e) => onUpdate("outputCardFolder", e.target.value)}
            placeholder={t("tools.placeholderRoot")}
            type="text"
            value={draft.outputCardFolder}
          />
        </label>
        <label className="setting-row">
          <span>{t("tools.cardName")}</span>
          <input
            onChange={(e) => onUpdate("outputName", e.target.value)}
            type="text"
            value={draft.outputName}
          />
        </label>
        <button className="primary-button" onClick={onMerge} type="button">
          {t("tools.merge")}
        </button>
        <ToolStatus status={status} />
      </div>
    </section>
  );
}

export function SplitCardToolSection({
  draft,
  onSplit,
  onSplitLevelChange,
  onUpdate,
  status
}: {
  draft: SplitCardDraft;
  onSplit: () => void;
  onSplitLevelChange: (value: SplitHeadingLevel) => void;
  onUpdate: <K extends keyof SplitCardDraft>(key: K, value: SplitCardDraft[K]) => void;
  status: string | null;
}): ReactElement {
  const t = useT();

  return (
    <section className="settings-group tools-settings-group">
      <div className="links-panel-subheading">{t("tools.splitByHeading")}</div>
      <div className="search-block">
        <label className="setting-row">
          <span>{t("tools.sourceCard")}</span>
          <input
            onChange={(e) => onUpdate("sourcePath", e.target.value)}
            placeholder={t("tools.placeholderSourceExample")}
            type="text"
            value={draft.sourcePath}
          />
        </label>
        <label className="setting-row">
          <span>{t("tools.headingLevel")}</span>
          <select
            onChange={(e) => onSplitLevelChange(Number(e.target.value) as SplitHeadingLevel)}
            value={draft.headingLevel}
          >
            <option value={1}>H1 (#)</option>
            <option value={2}>H2 (##)</option>
            <option value={3}>H3 (###)</option>
          </select>
        </label>
        <label className="setting-row">
          <span>{t("tools.outputCardFolder")}</span>
          <input
            onChange={(e) => onUpdate("outputCardFolder", e.target.value)}
            placeholder={t("tools.placeholderRoot")}
            type="text"
            value={draft.outputCardFolder}
          />
        </label>
        <button className="primary-button" onClick={onSplit} type="button">
          {t("tools.splitByHeading")}
        </button>
        <ToolStatus status={status} />
      </div>
    </section>
  );
}
