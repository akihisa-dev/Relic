import type { ReactElement } from "react";

import { useT } from "../i18n";
import type { TitleListDraft, TocDraft } from "../toolsSidebarModel";
import { ToolStatus } from "./ToolStatus";

export function TitleListToolSection({
  draft,
  onGenerate,
  onSortByChange,
  onUpdate,
  status
}: {
  draft: TitleListDraft;
  onGenerate: () => void;
  onSortByChange: (value: "name" | "mtime") => void;
  onUpdate: <K extends keyof TitleListDraft>(key: K, value: TitleListDraft[K]) => void;
  status: string | null;
}): ReactElement {
  const t = useT();

  return (
    <>
      <div className="links-panel-subheading">{t("tools.titleList")}</div>
      <div className="search-block">
        <label className="setting-row">
          <span>{t("tools.filterFolder")}</span>
          <input
            onChange={(e) => onUpdate("filterFolder", e.target.value)}
            placeholder={t("tools.placeholderAll")}
            type="text"
            value={draft.filterFolder}
          />
        </label>
        <label className="setting-row">
          <span>{t("tools.sort")}</span>
          <select
            onChange={(e) => onSortByChange(e.target.value as "name" | "mtime")}
            value={draft.sortBy}
          >
            <option value="name">{t("tools.sortName")}</option>
            <option value="mtime">{t("tools.sortMtime")}</option>
          </select>
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
        <button className="primary-button" onClick={onGenerate} type="button">
          {t("common.create")}
        </button>
        <ToolStatus status={status} />
      </div>
    </>
  );
}

export function TocToolSection({
  draft,
  onGenerate,
  onUpdate,
  status
}: {
  draft: TocDraft;
  onGenerate: () => void;
  onUpdate: <K extends keyof TocDraft>(key: K, value: TocDraft[K]) => void;
  status: string | null;
}): ReactElement {
  const t = useT();

  return (
    <>
      <div className="links-panel-subheading" style={{ marginTop: "1.5rem" }}>{t("tools.tableOfContents")}</div>
      <div className="search-block">
        <label className="setting-row">
          <span>{t("tools.filterFolder")}</span>
          <input
            onChange={(e) => onUpdate("targetFolder", e.target.value)}
            placeholder={t("tools.placeholderRoot")}
            type="text"
            value={draft.targetFolder}
          />
        </label>
        <label className="setting-row">
          <span>{t("tools.includeSubfolders")}</span>
          <input
            checked={draft.includeSubfolders}
            onChange={(e) => onUpdate("includeSubfolders", e.target.checked)}
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
        <button className="primary-button" onClick={onGenerate} type="button">
          {t("common.create")}
        </button>
        <ToolStatus status={status} />
      </div>
    </>
  );
}
