import type { ReactElement } from "react";

import { useT } from "../i18n";
import { type ToolActionId, useToolsPanelState } from "../hooks/useToolsPanelState";
import { ToolStatus } from "./ToolStatus";

interface ToolAction {
  descriptionKey: "tools.titleListDescription" | "tools.tocDescription" | "tools.tagIndexDescription" | "tools.mergeDescription";
  id: ToolActionId;
  labelKey: "tools.titleListAction" | "tools.tocAction" | "tools.tagIndexAction" | "tools.mergeAction";
  onRun: () => void;
}

export function ToolsPanel({ workspacePath }: { workspacePath: string | null }): ReactElement {
  const t = useT();
  const {
    handleGenerateTitleList,
    handleGenerateTagIndex,
    handleGenerateToc,
    handleMergeFiles,
    latestStatus,
    runningTool
  } = useToolsPanelState(workspacePath, t);
  const actions: ToolAction[] = [
    {
      descriptionKey: "tools.titleListDescription",
      id: "titleList",
      labelKey: "tools.titleListAction",
      onRun: handleGenerateTitleList
    },
    {
      descriptionKey: "tools.tocDescription",
      id: "toc",
      labelKey: "tools.tocAction",
      onRun: handleGenerateToc
    },
    {
      descriptionKey: "tools.tagIndexDescription",
      id: "tagIndex",
      labelKey: "tools.tagIndexAction",
      onRun: handleGenerateTagIndex
    },
    {
      descriptionKey: "tools.mergeDescription",
      id: "mergeFiles",
      labelKey: "tools.mergeAction",
      onRun: handleMergeFiles
    }
  ];

  return (
    <div className="settings-page tools-settings-page">
      <header className="settings-page-header">
        <p className="settings-page-kicker">{t("nav.tools")}</p>
        <h2>{t("tools.tools")}</h2>
        <p className="settings-page-description">{t("tools.oneClickDescription")}</p>
      </header>
      {!workspacePath ? (
        <div className="empty-note">{t("tools.workspaceRequired")}</div>
      ) : (
        <section className="settings-group tools-action-panel" aria-label={t("tools.actionsLabel")}>
          <div className="tools-target-row">
            <span>{t("tools.targetLabel")}</span>
            <strong>{t("tools.targetWorkspaceRoot")}</strong>
          </div>
          <div className="tools-action-grid">
            {actions.map((action) => (
              <button
                className="tool-action-button"
                disabled={runningTool !== null}
                key={action.id}
                onClick={action.onRun}
                type="button"
              >
                <span className="tool-action-title">{t(action.labelKey)}</span>
                <span className="tool-action-description">{t(action.descriptionKey)}</span>
                {runningTool === action.id ? (
                  <span className="tool-action-running">{t("common.running")}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="tools-result-panel" aria-live="polite">
            <span className="tools-result-label">{t("tools.latestResult")}</span>
            <ToolStatus status={latestStatus} />
          </div>
        </section>
      )}
    </div>
  );
}
