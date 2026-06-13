import type { MouseEvent, ReactElement } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import { chartIdForRailView, type AppRailView, type AppRailViewId } from "../appShellModel";
import type { PanelTabKind } from "../store/editorStore";
import type { SidebarView } from "../store/uiStore";
import { IconFiles } from "./RailNavigationIcons";
import { RailWorkspaceSwitcher } from "./RailWorkspaceSwitcher";

interface AppRailProps {
  activePanelTabIds: Set<PanelTabKind>;
  activeSidebarView: SidebarView;
  activeWorkspaceId: string | null;
  activeChartIds: Set<string>;
  chartRailViews: Array<AppRailView<ReactElement>>;
  isSidebarOpen: boolean;
  isWorkspaceRenameActive: boolean;
  isWorkspaceRenameHoldingRail: boolean;
  onChartButton: (view: AppRailViewId, label: string, event: MouseEvent<HTMLButtonElement>) => void;
  onCloseSidebar: () => void;
  onPanelButton: (panel: PanelTabKind, label: string, event: MouseEvent<HTMLButtonElement>) => void;
  onRemoveWorkspace: (id: string) => void;
  onRenameActiveChange: (isActive: boolean) => void;
  onRenameComplete: () => void;
  onRenameWorkspace: (id: string, currentName: string) => Promise<boolean>;
  onRevealWorkspace: (workspaceId: string) => void;
  revealWorkspaceLabel: string;
  onSetSidebarView: (view: SidebarView) => void;
  onSwitchWorkspace: (id: string) => void;
  openPanelTabIds: Set<PanelTabKind>;
  openChartIds: Set<string>;
  panelRailViews: Array<AppRailView<ReactElement>>;
  primaryRailViews: Array<AppRailView<ReactElement>>;
  registeredWorkspaces: WorkspaceState["workspaces"];
  renameLabel: string;
  removeWorkspaceLabel: (name: string) => string;
  viewSwitcherLabel: string;
  workspacesLabel: string;
}

export function AppRail({
  activePanelTabIds,
  activeSidebarView,
  activeWorkspaceId,
  activeChartIds,
  chartRailViews,
  isSidebarOpen,
  isWorkspaceRenameActive,
  isWorkspaceRenameHoldingRail,
  onChartButton,
  onCloseSidebar,
  onPanelButton,
  onRemoveWorkspace,
  onRenameActiveChange,
  onRenameComplete,
  onRenameWorkspace,
  onRevealWorkspace,
  revealWorkspaceLabel,
  onSetSidebarView,
  onSwitchWorkspace,
  openChartIds,
  openPanelTabIds,
  panelRailViews,
  primaryRailViews,
  registeredWorkspaces,
  renameLabel,
  removeWorkspaceLabel,
  viewSwitcherLabel,
  workspacesLabel
}: AppRailProps): ReactElement {
  return (
    <nav
      aria-label={viewSwitcherLabel}
      className={`rail${isWorkspaceRenameActive || isWorkspaceRenameHoldingRail ? " rail--workspace-editing" : ""}`}
    >
      {primaryRailViews.map((view) => (
        <button
          aria-label={view.label}
          className={primaryRailButtonClass(view, activeSidebarView, isSidebarOpen)}
          key={view.id}
          onClick={() => {
            if (view.id === activeSidebarView && isSidebarOpen) {
              onCloseSidebar();
              return;
            }

            onSetSidebarView(view.id as SidebarView);
          }}
          title={view.label}
          type="button"
        >
          {view.id === "files" ? <IconFiles sidebarOpen={isSidebarOpen} /> : view.icon}
          <span className="rail-button-label">{view.label}</span>
        </button>
      ))}
      {chartRailViews.map((view) => (
        <button
          aria-label={view.label}
          className={chartRailButtonClass(view, activeChartIds, openChartIds)}
          key={view.id}
          onClick={(event) => onChartButton(view.id, view.label, event)}
          title={view.label}
          type="button"
        >
          {view.icon}
          <span className="rail-button-label">{view.label}</span>
        </button>
      ))}
      <div className="rail-separator" />
      {panelRailViews.map((view) => (
        <button
          aria-label={view.label}
          className={`rail-button${activePanelTabIds.has(view.id as PanelTabKind) ? " active" : openPanelTabIds.has(view.id as PanelTabKind) ? " open" : ""}`}
          key={view.id}
          onClick={(event) => onPanelButton(view.id as PanelTabKind, view.label, event)}
          title={view.label}
          type="button"
        >
          {view.icon}
          <span className="rail-button-label">{view.label}</span>
        </button>
      ))}
      {registeredWorkspaces.length > 0 ? (
        <>
          <div className="rail-spacer" />
          <div className="rail-separator" />
          <RailWorkspaceSwitcher
            activeWorkspaceId={activeWorkspaceId}
            ariaLabel={workspacesLabel}
            onRenameActiveChange={onRenameActiveChange}
            onRenameComplete={onRenameComplete}
            onRemoveWorkspace={onRemoveWorkspace}
            onRenameWorkspace={onRenameWorkspace}
            onRevealWorkspace={onRevealWorkspace}
            revealWorkspaceLabel={revealWorkspaceLabel}
            onSwitchWorkspace={onSwitchWorkspace}
            renameLabel={renameLabel}
            removeLabel={removeWorkspaceLabel}
            workspaces={registeredWorkspaces}
          />
        </>
      ) : null}
    </nav>
  );
}

function chartRailButtonClass(
  view: AppRailView,
  activeChartIds: Set<string>,
  openChartIds: Set<string>
): string {
  const chartId = chartIdForRailView(view.id);

  return `rail-button${chartId && activeChartIds.has(chartId) ? " active" : chartId && openChartIds.has(chartId) ? " open" : ""}`;
}

function primaryRailButtonClass(
  view: AppRailView,
  activeSidebarView: SidebarView,
  isSidebarOpen: boolean
): string {
  return `rail-button${view.id === activeSidebarView && isSidebarOpen ? " active" : ""}`;
}
