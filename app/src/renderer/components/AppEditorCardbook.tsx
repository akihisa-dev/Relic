import type { EditorView } from "@codemirror/view";
import type { Dispatch, MouseEvent as ReactMouseEvent, MutableRefObject, ReactElement, ReactNode, SetStateAction } from "react";

import type { Backlink, EditorSettings, UserDefinedField } from "../../shared/ipc";
import type { ResolvedWikiLink } from "../../shared/links";
import type { AppLinkContextMenu } from "../appLinks";
import type { OutlineHeading } from "../editorDerivedState";
import { useT } from "../i18n";
import type { PaneId, PanelTabKind } from "../store/editorStore";
import type { RightPanelView } from "../store/uiStore";
import { AppRightPanel } from "./AppRightPanel";
import { PaneView } from "./PaneView";

interface AppEditorCardbookProps {
  allCardPaths: string[];
  backlinks: Backlink[];
  editorActionPulse: number;
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  frontmatterCandidates: Record<string, string[]>;
  isLoadingBacklinks: boolean;
  isRightPanelOpen: boolean;
  isRightPanelResizing: boolean;
  isSourceMode: boolean;
  isSplit: boolean;
  isSplitClosing: boolean;
  isTypewriterMode: boolean;
  leftClosingTabIds: Set<string>;
  leftEditorViewRef: MutableRefObject<EditorView | null>;
  leftPaneScrollHeading?: string;
  onCloseAllTabsInPane: (pane: PaneId) => void;
  onCloseOtherTabs: (pane: PaneId, tabId: string) => void;
  onCloseTabsToRight: (pane: PaneId, tabId: string) => void;
  onCreateCard: (name: string) => void;
  onDuplicateTabCard?: (tabId: string) => void;
  onEditorAction: () => void;
  onCardSaved: () => void;
  onOpenCard: (path: string) => void;
  onOpenInOtherPane: (pane: PaneId, tabId: string) => void;
  onOpenLink: (href: string) => void;
  onOpenWikiLink: (target: string, heading?: string) => void;
  onOutlineHeadingClick: (heading: string) => void;
  onRenameCard: (path: string, name: string) => void;
  onRightPanelResizeStart: (event: ReactMouseEvent) => void;
  onRevealTabCard?: (tabId: string) => void;
  onRightPanelViewButton: (view: RightPanelView) => void;
  onScrollTargetHandled: (pane: PaneId) => void;
  onSetFocusedPane: (pane: PaneId) => void;
  onSourceModeToggle: () => void;
  onSplitToggle: () => void;
  onTabClose: (pane: PaneId, tabId: string) => void;
  onTabMove: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  onTabSelect: (pane: PaneId, tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
  outlineHeadings: OutlineHeading[];
  outgoingLinks: ResolvedWikiLink[];
  renderTimelineTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
  renderPanelTabIcon: (panel: PanelTabKind) => ReactNode;
  rightClosingTabIds: Set<string>;
  rightEditorViewRef: MutableRefObject<EditorView | null>;
  rightPaneScrollHeading?: string;
  rightPanelView: RightPanelView;
  rightPanelWidth: number;
  setLinkContextMenu: Dispatch<SetStateAction<AppLinkContextMenu | null>>;
  showRightPanelControls: boolean;
  userDefinedFields: UserDefinedField[];
  cardbookPath?: string | null;
}

export function AppEditorCardbook({
  allCardPaths,
  backlinks,
  editorActionPulse,
  editorSettings,
  focusedPane,
  frontmatterCandidates,
  isLoadingBacklinks,
  isRightPanelOpen,
  isRightPanelResizing,
  isSourceMode,
  isSplit,
  isSplitClosing,
  isTypewriterMode,
  leftClosingTabIds,
  leftEditorViewRef,
  leftPaneScrollHeading,
  onCloseAllTabsInPane,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCreateCard,
  onDuplicateTabCard,
  onEditorAction,
  onCardSaved,
  onOpenCard,
  onOpenInOtherPane,
  onOpenLink,
  onOpenWikiLink,
  onOutlineHeadingClick,
  onRenameCard,
  onRightPanelResizeStart,
  onRevealTabCard,
  onRightPanelViewButton,
  onScrollTargetHandled,
  onSetFocusedPane,
  onSourceModeToggle,
  onSplitToggle,
  onTabClose,
  onTabMove,
  onTabSelect,
  onTogglePinTab,
  outlineHeadings,
  outgoingLinks,
  renderTimelineTab,
  renderPanelTab,
  renderPanelTabIcon,
  rightClosingTabIds,
  rightEditorViewRef,
  rightPaneScrollHeading,
  rightPanelView,
  rightPanelWidth,
  setLinkContextMenu,
  showRightPanelControls,
  userDefinedFields,
  cardbookPath
}: AppEditorCardbookProps): ReactElement {
  const t = useT();
  const paneActions = (
    <div className="main-area-actions">
      <button
        aria-label={t("pane.sourceShort")}
        className={`toolbar-btn${isSourceMode ? " active" : ""}`}
        data-tooltip={t("pane.sourceMode")}
        onClick={onSourceModeToggle}
        title={t("pane.sourceMode")}
        type="button"
      >
        <SourceModeIcon />
      </button>
      <button
        aria-label={t("pane.splitShort")}
        className={`toolbar-btn${isSplit ? " active" : ""}`}
        data-tooltip={t("pane.split")}
        onClick={onSplitToggle}
        title={t("pane.split")}
        type="button"
      >
        <SplitViewIcon />
      </button>
      {showRightPanelControls ? (
        <>
          <button
            aria-label={t("pane.outline")}
            className={`toolbar-btn${rightPanelView === "outline" && isRightPanelOpen ? " active" : ""}`}
            data-tooltip={t("pane.toggleOutline")}
            onClick={() => onRightPanelViewButton("outline")}
            title={t("pane.toggleOutline")}
            type="button"
          >
            <OutlineIcon />
          </button>
          <button
            aria-label={t("pane.links")}
            className={`toolbar-btn${rightPanelView === "links" && isRightPanelOpen ? " active" : ""}`}
            data-tooltip={t("pane.toggleLinks")}
            onClick={() => onRightPanelViewButton("links")}
            title={t("pane.toggleLinks")}
            type="button"
          >
            <LinksIcon />
          </button>
        </>
      ) : null}
    </div>
  );

  return (
    <main className="main-area">
      <div className="editor-layout">
        <div className="editor-cardbook">
          <div className={`panes-container${isSplit ? " panes-container--split" : ""}${isSplitClosing ? " panes-container--closing-split" : ""}`}>
            <PaneView
              actionSlot={!isSplit && !isRightPanelOpen ? paneActions : undefined}
              allCardPaths={allCardPaths}
              closingTabIds={leftClosingTabIds}
              editorActionPulse={focusedPane === "left" ? editorActionPulse : 0}
              editorSettings={editorSettings}
              focusedPane={focusedPane}
              frontmatterCandidates={frontmatterCandidates}
              isSplitView={isSplit}
              pane="left"
              renderTimelineTab={renderTimelineTab}
              renderPanelTab={renderPanelTab}
              renderPanelTabIcon={renderPanelTabIcon}
              scrollTargetHeading={leftPaneScrollHeading}
              sourceMode={isSourceMode}
              typewriterMode={isTypewriterMode}
              userDefinedFields={userDefinedFields}
              viewRef={leftEditorViewRef}
              cardbookPath={cardbookPath}
              onCloseAllTabs={() => onCloseAllTabsInPane("left")}
              onCloseOtherTabs={(tabId) => onCloseOtherTabs("left", tabId)}
              onCloseTabsToRight={(tabId) => onCloseTabsToRight("left", tabId)}
              onCreateCard={onCreateCard}
              onDuplicateTabCard={onDuplicateTabCard}
              onEditorAction={onEditorAction}
              onCardSaved={onCardSaved}
              onFocus={() => onSetFocusedPane("left")}
              onOpenInOtherPane={(tabId) => onOpenInOtherPane("left", tabId)}
              onOpenLink={onOpenLink}
              onOpenWikiLink={onOpenWikiLink}
              onRenameCard={onRenameCard}
              onRevealTabCard={onRevealTabCard}
              onScrollTargetHandled={() => onScrollTargetHandled("left")}
              onTabClose={(tabId) => onTabClose("left", tabId)}
              onTabMove={onTabMove}
              onTabSelect={(tabId) => onTabSelect("left", tabId)}
              onTogglePinTab={onTogglePinTab}
            />
            {isSplit ? (
              <PaneView
                actionSlot={isRightPanelOpen ? undefined : paneActions}
                allCardPaths={allCardPaths}
                closingTabIds={rightClosingTabIds}
                editorActionPulse={focusedPane === "right" ? editorActionPulse : 0}
                editorSettings={editorSettings}
                focusedPane={focusedPane}
                frontmatterCandidates={frontmatterCandidates}
                isSplitView={isSplit}
                pane="right"
                renderTimelineTab={renderTimelineTab}
                renderPanelTab={renderPanelTab}
                renderPanelTabIcon={renderPanelTabIcon}
                scrollTargetHeading={rightPaneScrollHeading}
                sourceMode={isSourceMode}
                typewriterMode={isTypewriterMode}
                userDefinedFields={userDefinedFields}
                viewRef={rightEditorViewRef}
                cardbookPath={cardbookPath}
                onCloseAllTabs={() => onCloseAllTabsInPane("right")}
                onCloseOtherTabs={(tabId) => onCloseOtherTabs("right", tabId)}
                onCloseTabsToRight={(tabId) => onCloseTabsToRight("right", tabId)}
                onCreateCard={onCreateCard}
                onDuplicateTabCard={onDuplicateTabCard}
                onEditorAction={onEditorAction}
                onCardSaved={onCardSaved}
                onFocus={() => onSetFocusedPane("right")}
                onOpenInOtherPane={(tabId) => onOpenInOtherPane("right", tabId)}
                onOpenLink={onOpenLink}
                onOpenWikiLink={onOpenWikiLink}
                onRenameCard={onRenameCard}
                onRevealTabCard={onRevealTabCard}
                onScrollTargetHandled={() => onScrollTargetHandled("right")}
                onTabClose={(tabId) => onTabClose("right", tabId)}
                onTabMove={onTabMove}
                onTabSelect={(tabId) => onTabSelect("right", tabId)}
                onTogglePinTab={onTogglePinTab}
              />
            ) : null}
          </div>
        </div>

        <AppRightPanel
          actionSlot={isRightPanelOpen ? paneActions : undefined}
          backlinks={backlinks}
          isLoadingBacklinks={isLoadingBacklinks}
          isOpen={isRightPanelOpen}
          isResizing={isRightPanelResizing}
          onOpenCard={onOpenCard}
          onOpenWikiLink={onOpenWikiLink}
          onOutlineHeadingClick={onOutlineHeadingClick}
          onResizeStart={onRightPanelResizeStart}
          outlineHeadings={outlineHeadings}
          outgoingLinks={outgoingLinks}
          rightPanelView={rightPanelView}
          setLinkContextMenu={setLinkContextMenu}
          width={rightPanelWidth}
        />
      </div>
    </main>
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
