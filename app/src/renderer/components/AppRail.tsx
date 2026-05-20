import type { MouseEvent, ReactElement } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import type { AppRailView } from "../appShellModel";
import type { PanelTabKind } from "../store/editorStore";
import type { SidebarView } from "../store/uiStore";
import { IconFiles, RailWorkspaceSwitcher } from "./RailNavigation";

interface AppRailProps {
  activePanelTabIds: Set<PanelTabKind>;
  activeSidebarView: SidebarView;
  activeWorkspaceId: string | null;
  chartRailView?: AppRailView<ReactElement>;
  isChartTabActive: boolean;
  isChartTabOpen: boolean;
  isSidebarOpen: boolean;
  isWorkspaceRenameActive: boolean;
  isWorkspaceRenameHoldingRail: boolean;
  onChartButton: (label: string, event: MouseEvent<HTMLButtonElement>) => void;
  onCloseSidebar: () => void;
  onPanelButton: (panel: PanelTabKind, label: string, event: MouseEvent<HTMLButtonElement>) => void;
  onRemoveWorkspace: (id: string) => void;
  onRenameActiveChange: (isActive: boolean) => void;
  onRenameComplete: () => void;
  onRenameWorkspace: (id: string, currentName: string) => Promise<boolean>;
  onSetSidebarView: (view: SidebarView) => void;
  onSwitchWorkspace: (id: string) => void;
  openPanelTabIds: Set<PanelTabKind>;
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
  chartRailView,
  isChartTabActive,
  isChartTabOpen,
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
  onSetSidebarView,
  onSwitchWorkspace,
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
          className={primaryRailButtonClass(view, activePanelTabIds, openPanelTabIds, activeSidebarView, isSidebarOpen)}
          key={view.id}
          onClick={(event) => {
            if (view.id === "graph" || view.id === "dashboard") {
              onPanelButton(view.id, view.label, event);
              return;
            }

            if (view.id === "files" && activeSidebarView === "files" && isSidebarOpen) {
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
      {chartRailView ? (
        <button
          aria-label={chartRailView.label}
          className={`rail-button${isChartTabActive ? " active" : isChartTabOpen ? " open" : ""}`}
          onClick={(event) => onChartButton(chartRailView.label, event)}
          title={chartRailView.label}
          type="button"
        >
          {chartRailView.icon}
          <span className="rail-button-label">{chartRailView.label}</span>
        </button>
      ) : null}
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

function primaryRailButtonClass(
  view: AppRailView,
  activePanelTabIds: Set<PanelTabKind>,
  openPanelTabIds: Set<PanelTabKind>,
  activeSidebarView: SidebarView,
  isSidebarOpen: boolean
): string {
  if (view.id === "graph" || view.id === "dashboard") {
    return `rail-button${activePanelTabIds.has(view.id) ? " active" : openPanelTabIds.has(view.id) ? " open" : ""}`;
  }

  return `rail-button${view.id === activeSidebarView && isSidebarOpen ? " active" : ""}`;
}
