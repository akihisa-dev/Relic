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
    <section className="settings-group tools-settings-group">
      <div className="links-panel-subheading">{t("tools.titleList")}</div>
      <div className="search-block">
        <label className="setting-row">
          <span>{t("tools.filterCardFolder")}</span>
          <input
            onChange={(e) => onUpdate("filterCardFolder", e.target.value)}
            placeholder={t("tools.placeholderAll")}
            type="text"
            value={draft.filterCardFolder}
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
        <button className="primary-button" onClick={onGenerate} type="button">
          {t("common.create")}
        </button>
        <ToolStatus status={status} />
      </div>
    </section>
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
    <section className="settings-group tools-settings-group">
      <div className="links-panel-subheading">{t("tools.tableOfContents")}</div>
      <div className="search-block">
        <label className="setting-row">
          <span>{t("tools.filterCardFolder")}</span>
          <input
            onChange={(e) => onUpdate("targetCardFolder", e.target.value)}
            placeholder={t("tools.placeholderRoot")}
            type="text"
            value={draft.targetCardFolder}
          />
        </label>
        <label className="setting-row">
          <span>{t("tools.includeSubcardFolders")}</span>
          <input
            checked={draft.includeSubcardFolders}
            onChange={(e) => onUpdate("includeSubcardFolders", e.target.checked)}
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
        <button className="primary-button" onClick={onGenerate} type="button">
          {t("common.create")}
        </button>
        <ToolStatus status={status} />
      </div>
    </section>
  );
}
