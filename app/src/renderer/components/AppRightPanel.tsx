import type { Dispatch, MouseEvent as ReactMouseEvent, ReactElement, SetStateAction } from "react";

import type { Backlink, EditorSettings, UserDefinedField } from "../../shared/ipc";
import type { ResolvedWikiLink } from "../../shared/links";
import type { AppLinkContextMenu } from "../appLinks";
import { markdownLinkForPath } from "../appLinks";
import type { OutlineHeading } from "../editorDerivedState";
import { useT } from "../i18n";
import type { FileTab } from "../store/editorStore";
import type { RightPanelView } from "../store/uiStore";
import { fixedMenuPosition } from "./railNavigationModel";
import { RightPanelFrontmatterForm } from "./RightPanelFrontmatterForm";

interface AppRightPanelProps {
  activeFileTab: FileTab | null;
  backlinks: Backlink[];
  editorSettings: EditorSettings;
  frontmatterCandidates: Record<string, string[]>;
  isLoadingBacklinks: boolean;
  isOpen: boolean;
  isResizing: boolean;
  onOpenFile: (path: string) => void;
  onOpenWikiLink: (target: string, heading?: string) => void;
  onOutlineHeadingClick: (heading: OutlineHeading) => void;
  onResizeStart: (event: ReactMouseEvent) => void;
  onUpdateTabContent: (tabId: string, content: string) => void;
  outlineHeadings: OutlineHeading[];
  outgoingLinks: ResolvedWikiLink[];
  outgoingLinksLimited: boolean;
  rightPanelView: RightPanelView;
  setLinkContextMenu: Dispatch<SetStateAction<AppLinkContextMenu | null>>;
  userDefinedFields: UserDefinedField[];
  width: number;
}

export function AppRightPanel({
  activeFileTab,
  backlinks,
  editorSettings,
  frontmatterCandidates,
  isLoadingBacklinks,
  isOpen,
  isResizing,
  onOpenFile,
  onOpenWikiLink,
  onOutlineHeadingClick,
  onResizeStart,
  onUpdateTabContent,
  outlineHeadings,
  outgoingLinks,
  outgoingLinksLimited,
  rightPanelView,
  setLinkContextMenu,
  userDefinedFields,
  width
}: AppRightPanelProps): ReactElement {
  const t = useT();

  void isResizing;
  void onResizeStart;

  return (
    <aside
      aria-label={rightPanelTitle(rightPanelView, t)}
      aria-hidden={!isOpen}
      className={`right-panel${isOpen ? "" : " right-panel--closed"}${isResizing ? " right-panel--resizing" : ""}`}
      style={{ flexBasis: isOpen ? width : 0, width: isOpen ? width : 0 }}
    >
      <div className="right-panel-title">
        {rightPanelTitle(rightPanelView, t)}
      </div>
      <div className={`sidebar-body right-panel-content right-panel-content--${rightPanelView}`}>
      {rightPanelView === "outline" ? (
        outlineHeadings.length > 0 ? (
          <ul className="outline-list">
            {outlineHeadings.map((heading) => (
              <li className={`outline-item outline-item--h${heading.level}`} key={`${heading.from}-${heading.level}-${heading.text}`} title={heading.text}>
                <button
                  aria-label={heading.text}
                  className="outline-item-button"
                  onClick={() => onOutlineHeadingClick(heading)}
                  type="button"
                >
                  <span className="outline-item-text">{heading.text}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-note">{t("empty.noHeadings")}</div>
        )
      ) : rightPanelView === "frontmatter" ? (
        <RightPanelFrontmatterForm
          activeFileTab={activeFileTab}
          editorSettings={editorSettings}
          frontmatterCandidates={frontmatterCandidates}
          onUpdateTabContent={onUpdateTabContent}
          userDefinedFields={userDefinedFields}
        />
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
                      onClick={() => onOpenWikiLink(link.wikiLink.target, link.wikiLink.heading ?? undefined)}
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

function rightPanelTitle(view: RightPanelView, t: ReturnType<typeof useT>): string {
  if (view === "outline") return t("pane.outline");
  if (view === "frontmatter") return t("pane.frontmatter");
  return t("pane.links");
}
