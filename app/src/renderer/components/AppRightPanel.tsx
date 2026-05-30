import type { Dispatch, MouseEvent as ReactMouseEvent, ReactElement, SetStateAction } from "react";

import type { Backlink } from "../../shared/ipc";
import type { ResolvedWikiLink } from "../../shared/links";
import type { AppLinkContextMenu } from "../appLinks";
import { markdownLinkForPath } from "../appLinks";
import type { OutlineHeading } from "../editorDerivedState";
import { useT } from "../i18n";
import type { RightPanelView } from "../store/uiStore";
import type { AIWorkspaceState } from "../../shared/ipc";
import { AIWorkspacePanel } from "./AIWorkspacePanel";
import { fixedMenuPosition } from "./railNavigationModel";

interface AppRightPanelProps {
  aiWorkspaceState: AIWorkspaceState | null;
  backlinks: Backlink[];
  isAIWorkspaceLoading: boolean;
  isAIWorkspaceSending: boolean;
  isLoadingBacklinks: boolean;
  isOpen: boolean;
  isResizing: boolean;
  onAIWorkspaceClearData: () => void;
  onAIWorkspaceApplyOperations: () => void;
  onAIWorkspaceRebuildIndex: () => void;
  onAIWorkspaceDiscardOperations: () => void;
  onAIWorkspaceSendMessage: (message: string) => void;
  onOpenFile: (path: string) => void;
  onOpenWikiLink: (target: string, heading?: string) => void;
  onOutlineHeadingClick: (heading: string) => void;
  onResizeStart: (event: ReactMouseEvent) => void;
  outlineHeadings: OutlineHeading[];
  outgoingLinks: ResolvedWikiLink[];
  outgoingLinksLimited: boolean;
  rightPanelView: RightPanelView;
  setLinkContextMenu: Dispatch<SetStateAction<AppLinkContextMenu | null>>;
  width: number;
  workspaceName?: string | null;
}

export function AppRightPanel({
  aiWorkspaceState,
  backlinks,
  isAIWorkspaceLoading,
  isAIWorkspaceSending,
  isLoadingBacklinks,
  isOpen,
  isResizing,
  onAIWorkspaceClearData,
  onAIWorkspaceApplyOperations,
  onAIWorkspaceRebuildIndex,
  onAIWorkspaceDiscardOperations,
  onAIWorkspaceSendMessage,
  onOpenFile,
  onOpenWikiLink,
  onOutlineHeadingClick,
  onResizeStart,
  outlineHeadings,
  outgoingLinks,
  outgoingLinksLimited,
  rightPanelView,
  setLinkContextMenu,
  width,
  workspaceName
}: AppRightPanelProps): ReactElement {
  const t = useT();

  return (
    <aside
      aria-label={rightPanelView === "ai" ? "AI" : rightPanelView === "outline" ? t("pane.outline") : t("pane.links")}
      aria-hidden={!isOpen}
      className={`right-panel${isOpen ? "" : " right-panel--closed"}${isResizing ? " right-panel--resizing" : ""}`}
      style={{ flexBasis: isOpen ? width : 0, width: isOpen ? width : 0 }}
    >
      <button
        aria-label={t("pane.resizeRightPanel")}
        className={`right-panel-resize-handle${isResizing ? " right-panel-resize-handle--active" : ""}`}
        onMouseDown={onResizeStart}
        type="button"
      />
      <div className={`sidebar-body right-panel-content right-panel-content--${rightPanelView}`}>
      {rightPanelView === "ai" ? (
        <AIWorkspacePanel
          isLoading={isAIWorkspaceLoading}
          isSending={isAIWorkspaceSending}
          onClearData={onAIWorkspaceClearData}
          onApplyOperations={onAIWorkspaceApplyOperations}
          onDiscardOperations={onAIWorkspaceDiscardOperations}
          onOpenFile={onOpenFile}
          onRebuildIndex={onAIWorkspaceRebuildIndex}
          onSendMessage={onAIWorkspaceSendMessage}
          state={aiWorkspaceState}
          workspaceName={workspaceName}
        />
      ) : rightPanelView === "outline" ? (
        outlineHeadings.length > 0 ? (
          <ul className="outline-list">
            {outlineHeadings.map((heading) => (
              <li className={`outline-item outline-item--h${heading.level}`} key={`${heading.level}-${heading.text}`} title={heading.text}>
                <button className="outline-item-button" onClick={() => onOutlineHeadingClick(heading.text)} type="button">
                  {heading.text}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-note">{t("empty.noHeadings")}</div>
        )
      ) : outgoingLinks.length > 0 || backlinks.length > 0 || isLoadingBacklinks ? (
        <div className="links-panel-stack">
          <div className="links-panel-section">
            <div className="links-panel-subheading">{t("links.outgoing")}</div>
            {outgoingLinksLimited ? (
              <div className="list-loading-note">{t("links.outgoingLimited")}</div>
            ) : null}
            {outgoingLinks.length > 0 ? (
              <ul className="links-list">
                {outgoingLinks.map((link) => (
                  <li className="links-list-item" key={`${link.wikiLink.kind}-${link.wikiLink.raw}-${link.wikiLink.target}`}>
                    <span className={`links-list-kind links-list-kind--${link.wikiLink.kind}`}>
                      {link.wikiLink.kind === "embed" ? t("links.embed") : t("links.link")}
                    </span>
                    <button
                      className={`links-list-target${link.exists ? "" : " links-list-target--missing"}`}
                      onClick={() => onOpenWikiLink(link.wikiLink.target)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setLinkContextMenu({
                          heading: link.wikiLink.heading ?? undefined,
                          markdownLink: link.wikiLink.raw,
                          openKind: "wiki",
                          path: link.path,
                          target: link.wikiLink.target,
                          ...fixedMenuPosition(event.clientX, event.clientY)
                        });
                      }}
                      title={link.exists ? link.path : t("links.createAndOpen", { path: link.path })}
                      type="button"
                    >
                      {link.displayName}
                    </button>
                    {!link.exists ? (
                      <span className="links-list-detail">{t("links.missing")}</span>
                    ) : null}
                    {link.wikiLink.heading ? (
                      <span className="links-list-detail">#{link.wikiLink.heading}</span>
                    ) : null}
                    {link.wikiLink.blockId ? (
                      <span className="links-list-detail">^{link.wikiLink.blockId}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-note">{t("empty.noLinks")}</div>
            )}
          </div>
          <div className="links-panel-section">
            <div className="links-panel-subheading">{t("links.backlinks")}</div>
            {isLoadingBacklinks ? (
              <div className="list-loading-note">{t("common.loading")}</div>
            ) : backlinks.length > 0 ? (
              <ul className="links-list">
                {backlinks.map((backlink) => (
                  <li className="links-list-item" key={backlink.sourcePath}>
                    <span className="links-list-kind links-list-kind--backlink">
                      Back
                    </span>
                    <button
                      className="links-list-target"
                      onClick={() => onOpenFile(backlink.sourcePath)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setLinkContextMenu({
                          markdownLink: markdownLinkForPath(backlink.sourcePath),
                          openKind: "file",
                          path: backlink.sourcePath,
                          ...fixedMenuPosition(event.clientX, event.clientY)
                        });
                      }}
                      title={backlink.sourcePath}
                      type="button"
                    >
                      {backlink.sourceName}
                    </button>
                    {backlink.count > 1 ? (
                      <span className="links-list-detail">{backlink.count}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-note">{t("empty.noBacklinks")}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-note">{t("empty.noLinks")}</div>
      )}
      </div>
    </aside>
  );
}
