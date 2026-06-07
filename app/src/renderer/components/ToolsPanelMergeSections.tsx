import type { ReactElement } from "react";

import type { MergeFilterType, MergeSortBy } from "../../shared/ipc";
import { useT } from "../i18n";
import type { MergeFilesDraft } from "../toolsPanelModel";
import { ToolStatus } from "./ToolStatus";

export function MergeFilesToolSection({
  draft,
  onMerge,
  onFilterTypeChange,
  onSortByChange,
  onUpdate,
  status
}: {
  draft: MergeFilesDraft;
  onMerge: () => void;
  onFilterTypeChange: (value: MergeFilterType) => void;
  onSortByChange: (value: MergeSortBy) => void;
  onUpdate: <K extends keyof MergeFilesDraft>(key: K, value: MergeFilesDraft[K]) => void;
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
            <option value="folder">{t("tools.filterFolder")}</option>
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
            <span>{draft.filterType === "folder" ? t("tools.folderName") : t("tools.tagName")}</span>
            <input
              onChange={(e) => onUpdate("filterValue", e.target.value)}
              placeholder={draft.filterType === "folder" ? t("tools.placeholderFolderExample") : t("tools.placeholderTagExample")}
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
          <span>{t("tools.fileNameHeading")}</span>
          <input
            checked={draft.insertFilenameHeading}
            onChange={(e) => onUpdate("insertFilenameHeading", e.target.checked)}
            type="checkbox"
          />
        </label>
        <label className="setting-row">
          <span>{t("tools.outputFolder")}</span>
          <input
            onChange={(e) => onUpdate("outputFolder", e.target.value)}
            placeholder={t("tools.placeholderRoot")}
            type="text"
            value={draft.outputFolder}
          />
        </label>
        <label className="setting-row">
          <span>{t("tools.fileName")}</span>
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
