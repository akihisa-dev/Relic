import type { MouseEvent, ReactElement } from "react";

import type { CardbookState } from "../../shared/ipc";
import type { AppRailView } from "../appShellModel";
import type { PanelTabKind } from "../store/editorStore";
import type { SidebarView } from "../store/uiStore";
import { IconCards, RailCardbookSwitcher } from "./RailNavigation";

interface AppRailProps {
  activePanelTabIds: Set<PanelTabKind>;
  activeSidebarView: SidebarView;
  activeCardbookId: string | null;
  chartRailView?: AppRailView<ReactElement>;
  isChartTabActive: boolean;
  isChartTabOpen: boolean;
  isSidebarOpen: boolean;
  isCardbookRenameActive: boolean;
  isCardbookRenameHoldingRail: boolean;
  onChartButton: (label: string, event: MouseEvent<HTMLButtonElement>) => void;
  onCloseSidebar: () => void;
  onPanelButton: (panel: PanelTabKind, label: string, event: MouseEvent<HTMLButtonElement>) => void;
  onRemoveCardbook: (id: string) => void;
  onRenameActiveChange: (isActive: boolean) => void;
  onRenameComplete: () => void;
  onRenameCardbook: (id: string, currentName: string) => Promise<boolean>;
  onSetSidebarView: (view: SidebarView) => void;
  onSwitchCardbook: (id: string) => void;
  openPanelTabIds: Set<PanelTabKind>;
  panelRailViews: Array<AppRailView<ReactElement>>;
  primaryRailViews: Array<AppRailView<ReactElement>>;
  registeredCardbooks: CardbookState["cardbooks"];
  renameLabel: string;
  removeCardbookLabel: (name: string) => string;
  viewSwitcherLabel: string;
  cardbooksLabel: string;
}

export function AppRail({
  activePanelTabIds,
  activeSidebarView,
  activeCardbookId,
  chartRailView,
  isChartTabActive,
  isChartTabOpen,
  isSidebarOpen,
  isCardbookRenameActive,
  isCardbookRenameHoldingRail,
  onChartButton,
  onCloseSidebar,
  onPanelButton,
  onRemoveCardbook,
  onRenameActiveChange,
  onRenameComplete,
  onRenameCardbook,
  onSetSidebarView,
  onSwitchCardbook,
  openPanelTabIds,
  panelRailViews,
  primaryRailViews,
  registeredCardbooks,
  renameLabel,
  removeCardbookLabel,
  viewSwitcherLabel,
  cardbooksLabel
}: AppRailProps): ReactElement {
  return (
    <nav
      aria-label={viewSwitcherLabel}
      className={`rail${isCardbookRenameActive || isCardbookRenameHoldingRail ? " rail--cardbook-editing" : ""}`}
    >
      {primaryRailViews.map((view) => (
        <button
          aria-label={view.label}
          className={primaryRailButtonClass(view, activeSidebarView, isSidebarOpen)}
          key={view.id}
          onClick={() => {
            if (view.id === "cards" && activeSidebarView === "cards" && isSidebarOpen) {
              onCloseSidebar();
              return;
            }

            onSetSidebarView(view.id as SidebarView);
          }}
          title={view.label}
          type="button"
        >
          {view.id === "cards" ? <IconCards sidebarOpen={isSidebarOpen} /> : view.icon}
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
      {registeredCardbooks.length > 0 ? (
        <>
          <div className="rail-spacer" />
          <div className="rail-separator" />
          <RailCardbookSwitcher
            activeCardbookId={activeCardbookId}
            ariaLabel={cardbooksLabel}
            onRenameActiveChange={onRenameActiveChange}
            onRenameComplete={onRenameComplete}
            onRemoveCardbook={onRemoveCardbook}
            onRenameCardbook={onRenameCardbook}
            onSwitchCardbook={onSwitchCardbook}
            renameLabel={renameLabel}
            removeLabel={removeCardbookLabel}
            cardbooks={registeredCardbooks}
          />
        </>
      ) : null}
    </nav>
  );
}

function primaryRailButtonClass(
  view: AppRailView,
  activeSidebarView: SidebarView,
  isSidebarOpen: boolean
): string {
  return `rail-button${view.id === activeSidebarView && isSidebarOpen ? " active" : ""}`;
}
