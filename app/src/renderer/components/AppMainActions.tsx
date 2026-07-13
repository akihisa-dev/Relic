import type { ReactElement } from "react";

import { useT } from "../i18n";
import { formatShortcut } from "../keyboardShortcuts";
import type { RightPanelView } from "../store/uiStore";
import { DelayedTooltip } from "./DelayedTooltip";

interface AppMainActionsProps {
  isRightPanelOpen: boolean;
  isSourceMode?: boolean;
  isSplit: boolean;
  onRightPanelViewButton: (view: RightPanelView) => void;
  onSourceModeToggle?: () => void;
  onSplitToggle: () => void;
  rightPanelView: RightPanelView;
  showSourceControl?: boolean;
  showRightPanelLinksControl: boolean;
  showRightPanelOutlineControl: boolean;
  showRightPanelRecoveryControl: boolean;
}

export function AppMainActions({
  isRightPanelOpen,
  isSourceMode = false,
  isSplit,
  onRightPanelViewButton,
  onSourceModeToggle,
  onSplitToggle,
  rightPanelView,
  showSourceControl = true,
  showRightPanelLinksControl,
  showRightPanelOutlineControl,
  showRightPanelRecoveryControl
}: AppMainActionsProps): ReactElement {
  const t = useT();
  const splitShortcut = formatShortcut(["mod", "\\"]);
  const toggleOutlineShortcut = formatShortcut(["mod", "shift", "B"]);

  return (
    <div className="main-area-actions">
      {showSourceControl && onSourceModeToggle ? (
        <SourceModeButton
          isSourceMode={isSourceMode}
          onSourceModeToggle={onSourceModeToggle}
        />
      ) : null}
      <DelayedTooltip label={t("pane.split", { shortcut: splitShortcut })}>
        <button
          aria-label={t("pane.splitShort")}
          className={`toolbar-btn${isSplit ? " active" : ""}`}
          onClick={onSplitToggle}
          type="button"
        >
          <SplitViewIcon />
        </button>
      </DelayedTooltip>
      {showRightPanelOutlineControl ? (
        <DelayedTooltip label={t("pane.toggleOutline", { shortcut: toggleOutlineShortcut })}>
          <button
            aria-label={t("pane.outline")}
            className={`toolbar-btn${rightPanelView === "outline" && isRightPanelOpen ? " active" : ""}`}
            onClick={() => onRightPanelViewButton("outline")}
            type="button"
          >
            <OutlineIcon />
          </button>
        </DelayedTooltip>
      ) : null}
      {showRightPanelLinksControl ? (
        <DelayedTooltip label={t("pane.toggleLinks")}>
          <button
            aria-label={t("pane.links")}
            className={`toolbar-btn${rightPanelView === "links" && isRightPanelOpen ? " active" : ""}`}
            onClick={() => onRightPanelViewButton("links")}
            type="button"
          >
            <LinksIcon />
          </button>
        </DelayedTooltip>
      ) : null}
      {showRightPanelRecoveryControl ? (
        <DelayedTooltip label={t("pane.toggleRecovery")}>
          <button
            aria-label={t("pane.recovery")}
            className={`toolbar-btn${rightPanelView === "recovery" && isRightPanelOpen ? " active" : ""}`}
            onClick={() => onRightPanelViewButton("recovery")}
            type="button"
          >
            <RecoveryIcon />
          </button>
        </DelayedTooltip>
      ) : null}
    </div>
  );
}

interface SourceModeButtonProps {
  isSourceMode: boolean;
  onSourceModeToggle: () => void;
}

export function SourceModeButton({ isSourceMode, onSourceModeToggle }: SourceModeButtonProps): ReactElement {
  const t = useT();

  return (
    <DelayedTooltip label={t("pane.sourceMode")}>
      <button
        aria-label={t("pane.sourceShort")}
        className={`toolbar-btn${isSourceMode ? " active" : ""}`}
        onClick={onSourceModeToggle}
        type="button"
      >
        <SourceModeIcon />
      </button>
    </DelayedTooltip>
  );
}

function SourceModeIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <path d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
    </svg>
  );
}

function SplitViewIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <path d="M12 20v2" />
      <path d="M12 14v2" />
      <path d="M12 8v2" />
      <path d="M12 2v2" />
    </svg>
  );
}

function OutlineIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <path d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

function LinksIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <path d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  );
}

function RecoveryIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <path d="M3 12a9 9 0 1 0 3-6.708" />
      <path d="M3 4.5v5h5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
