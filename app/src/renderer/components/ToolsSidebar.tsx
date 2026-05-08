import { useState } from "react";
import type { ReactElement } from "react";

import { type MergeFilterType, type MergeSortBy, type SplitHeadingLevel } from "../../shared/ipc";
import { useT } from "../i18n";

export function ToolsSidebar({ workspacePath }: { workspacePath: string | null }): ReactElement {
  const t = useT();
  const [titleListFolder, setTitleListFolder] = useState("");
  const [titleListOutputFolder, setTitleListOutputFolder] = useState("");
  const [titleListOutputName, setTitleListOutputName] = useState("Title List");
  const [titleListSort, setTitleListSort] = useState<"name" | "mtime">("name");
  const [titleListStatus, setTitleListStatus] = useState<string | null>(null);

  const [tocFolder, setTocFolder] = useState("");
  const [tocOutputFolder, setTocOutputFolder] = useState("");
  const [tocOutputName, setTocOutputName] = useState("Table of Contents");
  const [tocSubfolders, setTocSubfolders] = useState(true);
  const [tocStatus, setTocStatus] = useState<string | null>(null);

  const [mergeFilterType, setMergeFilterType] = useState<MergeFilterType>("all");
  const [mergeFrontmatterField, setMergeFrontmatterField] = useState("");
  const [mergeFilterValue, setMergeFilterValue] = useState("");
  const [mergeSortBy, setMergeSortBy] = useState<MergeSortBy>("name");
  const [mergeInsertHeading, setMergeInsertHeading] = useState(true);
  const [mergeOutputFolder, setMergeOutputFolder] = useState("");
  const [mergeOutputName, setMergeOutputName] = useState("Merged Result");
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);

  const [splitSource, setSplitSource] = useState("");
  const [splitLevel, setSplitLevel] = useState<SplitHeadingLevel>(2);
  const [splitOutputFolder, setSplitOutputFolder] = useState("");
  const [splitStatus, setSplitStatus] = useState<string | null>(null);

  const handleGenerateTitleList = async () => {
    if (!workspacePath) return;
    setTitleListStatus(t("common.running"));
    const result = await window.relic!.generateTitleList({
      filterFolder: titleListFolder || undefined,
      outputFolder: titleListOutputFolder || ".",
      outputName: titleListOutputName || t("tools.titleListDefaultName"),
      sortBy: titleListSort
    });
    setTitleListStatus(result.ok ? `Done: ${result.value}` : `Error: ${result.error.message}`);
  };

  const handleGenerateToc = async () => {
    if (!workspacePath) return;
    setTocStatus(t("common.running"));
    const result = await window.relic!.generateTableOfContents({
      includeSubfolders: tocSubfolders,
      outputFolder: tocOutputFolder || ".",
      outputName: tocOutputName || t("tools.tocDefaultName"),
      targetFolder: tocFolder || "."
    });
    setTocStatus(result.ok ? `Done: ${result.value}` : `Error: ${result.error.message}`);
  };

  const handleMergeFiles = async () => {
    if (!workspacePath) return;
    setMergeStatus(t("tools.processing"));
    const result = await window.relic!.mergeFiles({
      frontmatterField: mergeFilterType === "frontmatter" ? mergeFrontmatterField : undefined,
      filterType: mergeFilterType,
      filterValue: mergeFilterValue,
      insertFilenameHeading: mergeInsertHeading,
      outputFolder: mergeOutputFolder || ".",
      outputName: mergeOutputName || t("tools.mergeDefaultName"),
      sortBy: mergeSortBy
    });
    setMergeStatus(result.ok ? `Done: ${result.value}` : `Error: ${result.error.message}`);
  };

  const handleSplitFile = async () => {
    if (!workspacePath || !splitSource) return;
    setSplitStatus(t("tools.processing"));
    const result = await window.relic!.splitFileByHeading({
      headingLevel: splitLevel,
      outputFolder: splitOutputFolder || ".",
      sourcePath: splitSource
    });
    setSplitStatus(
      result.ok
        ? `Done: ${result.value.length} file(s) created`
        : `Error: ${result.error.message}`
    );
  };

  return (
    <div className="sidebar-section">
      <div className="pane-heading">{t("tools.tools")}</div>
      {!workspacePath ? (
        <div className="empty-note">{t("tools.workspaceRequired")}</div>
      ) : (
        <>
          <div className="links-panel-subheading">{t("tools.titleList")}</div>
          <div className="search-block">
            <label className="setting-row">
              <span>{t("tools.filterFolder")}</span>
              <input
                onChange={(e) => setTitleListFolder(e.target.value)}
                placeholder={t("tools.placeholderAll")}
                type="text"
                value={titleListFolder}
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.sort")}</span>
              <select
                onChange={(e) => setTitleListSort(e.target.value as "name" | "mtime")}
                value={titleListSort}
              >
                <option value="name">{t("tools.sortName")}</option>
                <option value="mtime">{t("tools.sortMtime")}</option>
              </select>
            </label>
            <label className="setting-row">
              <span>{t("tools.outputFolder")}</span>
              <input
                onChange={(e) => setTitleListOutputFolder(e.target.value)}
                placeholder={t("tools.placeholderRoot")}
                type="text"
                value={titleListOutputFolder}
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.fileName")}</span>
              <input
                onChange={(e) => setTitleListOutputName(e.target.value)}
                type="text"
                value={titleListOutputName}
              />
            </label>
            <button className="primary-button" onClick={handleGenerateTitleList} type="button">
              {t("common.create")}
            </button>
            {titleListStatus && <div className={`tool-status${titleListStatus.startsWith("Error") ? " tool-status--error" : " tool-status--success"}`}>{titleListStatus}</div>}
          </div>

          <div className="links-panel-subheading" style={{ marginTop: "1.5rem" }}>{t("tools.tableOfContents")}</div>
          <div className="search-block">
            <label className="setting-row">
              <span>{t("tools.filterFolder")}</span>
              <input
                onChange={(e) => setTocFolder(e.target.value)}
                placeholder={t("tools.placeholderRoot")}
                type="text"
                value={tocFolder}
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.includeSubfolders")}</span>
              <input
                checked={tocSubfolders}
                onChange={(e) => setTocSubfolders(e.target.checked)}
                type="checkbox"
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.outputFolder")}</span>
              <input
                onChange={(e) => setTocOutputFolder(e.target.value)}
                placeholder={t("tools.placeholderRoot")}
                type="text"
                value={tocOutputFolder}
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.fileName")}</span>
              <input
                onChange={(e) => setTocOutputName(e.target.value)}
                type="text"
                value={tocOutputName}
              />
            </label>
            <button className="primary-button" onClick={handleGenerateToc} type="button">
              {t("common.create")}
            </button>
            {tocStatus && <div className={`tool-status${tocStatus.startsWith("Error") ? " tool-status--error" : " tool-status--success"}`}>{tocStatus}</div>}
          </div>

          <div className="links-panel-subheading" style={{ marginTop: "1.5rem" }}>{t("tools.merge")}</div>
          <div className="search-block">
            <label className="setting-row">
              <span>{t("tools.filter")}</span>
              <select
                onChange={(e) => setMergeFilterType(e.target.value as MergeFilterType)}
                value={mergeFilterType}
              >
                <option value="all">{t("tools.filterAll")}</option>
                <option value="folder">{t("tools.filterFolder")}</option>
                <option value="tag">{t("tools.filterTag")}</option>
                <option value="frontmatter">{t("tools.filterFrontmatter")}</option>
              </select>
            </label>
            {mergeFilterType === "frontmatter" ? (
              <>
                <label className="setting-row">
                  <span>{t("tools.frontmatterField")}</span>
                  <input
                    onChange={(e) => setMergeFrontmatterField(e.target.value)}
                    placeholder={t("tools.placeholderFrontmatterFieldExample")}
                    type="text"
                    value={mergeFrontmatterField}
                  />
                </label>
                <label className="setting-row">
                  <span>{t("tools.frontmatterValue")}</span>
                  <input
                    onChange={(e) => setMergeFilterValue(e.target.value)}
                    placeholder={t("tools.placeholderFrontmatterValueExample")}
                    type="text"
                    value={mergeFilterValue}
                  />
                </label>
              </>
            ) : mergeFilterType !== "all" && (
              <label className="setting-row">
                <span>{mergeFilterType === "folder" ? t("tools.folderName") : t("tools.tagName")}</span>
                <input
                  onChange={(e) => setMergeFilterValue(e.target.value)}
                  placeholder={mergeFilterType === "folder" ? t("tools.placeholderFolderExample") : t("tools.placeholderTagExample")}
                  type="text"
                  value={mergeFilterValue}
                />
              </label>
            )}
            <label className="setting-row">
              <span>{t("tools.sort")}</span>
              <select
                onChange={(e) => setMergeSortBy(e.target.value as MergeSortBy)}
                value={mergeSortBy}
              >
                <option value="name">{t("tools.sortName")}</option>
                <option value="mtime">{t("tools.sortMtime")}</option>
                <option value="ctime">{t("tools.sortCtime")}</option>
              </select>
            </label>
            <label className="setting-row">
              <span>{t("tools.fileNameHeading")}</span>
              <input
                checked={mergeInsertHeading}
                onChange={(e) => setMergeInsertHeading(e.target.checked)}
                type="checkbox"
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.outputFolder")}</span>
              <input
                onChange={(e) => setMergeOutputFolder(e.target.value)}
                placeholder={t("tools.placeholderRoot")}
                type="text"
                value={mergeOutputFolder}
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.fileName")}</span>
              <input
                onChange={(e) => setMergeOutputName(e.target.value)}
                type="text"
                value={mergeOutputName}
              />
            </label>
            <button className="primary-button" onClick={handleMergeFiles} type="button">
              {t("tools.merge")}
            </button>
            {mergeStatus && <div className={`tool-status${mergeStatus.startsWith("Error") ? " tool-status--error" : " tool-status--success"}`}>{mergeStatus}</div>}
          </div>

          <div className="links-panel-subheading" style={{ marginTop: "1.5rem" }}>{t("tools.splitByHeading")}</div>
          <div className="search-block">
            <label className="setting-row">
              <span>{t("tools.sourceFile")}</span>
              <input
                onChange={(e) => setSplitSource(e.target.value)}
                placeholder={t("tools.placeholderSourceExample")}
                type="text"
                value={splitSource}
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.headingLevel")}</span>
              <select
                onChange={(e) => setSplitLevel(Number(e.target.value) as SplitHeadingLevel)}
                value={splitLevel}
              >
                <option value={1}>H1 (#)</option>
                <option value={2}>H2 (##)</option>
                <option value={3}>H3 (###)</option>
              </select>
            </label>
            <label className="setting-row">
              <span>{t("tools.outputFolder")}</span>
              <input
                onChange={(e) => setSplitOutputFolder(e.target.value)}
                placeholder={t("tools.placeholderRoot")}
                type="text"
                value={splitOutputFolder}
              />
            </label>
            <button className="primary-button" onClick={handleSplitFile} type="button">
              {t("tools.splitByHeading")}
            </button>
            {splitStatus && <div className={`tool-status${splitStatus.startsWith("Error") ? " tool-status--error" : " tool-status--success"}`}>{splitStatus}</div>}
          </div>
        </>
      )}
    </div>
  );
}
