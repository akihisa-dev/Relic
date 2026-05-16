import type { Dispatch, ReactElement, SetStateAction } from "react";

import type { Backlink } from "../../shared/ipc";
import type { ResolvedWikiLink } from "../../shared/links";
import type { AppLinkContextMenu } from "../appLinks";
import { markdownLinkForPath } from "../appLinks";
import type { OutlineHeading } from "../editorDerivedState";
import { useT } from "../i18n";
import type { RightPanelView } from "../store/uiStore";
import { fixedMenuPosition } from "./RailNavigation";

interface AppRightPanelProps {
  backlinks: Backlink[];
  isLoadingBacklinks: boolean;
  isOpen: boolean;
  onOpenFile: (path: string) => void;
  onOpenWikiLink: (target: string, heading?: string) => void;
  onOutlineHeadingClick: (heading: string) => void;
  outlineHeadings: OutlineHeading[];
  outgoingLinks: ResolvedWikiLink[];
  rightPanelView: RightPanelView;
  setLinkContextMenu: Dispatch<SetStateAction<AppLinkContextMenu | null>>;
}

export function AppRightPanel({
  backlinks,
  isLoadingBacklinks,
  isOpen,
  onOpenFile,
  onOpenWikiLink,
  onOutlineHeadingClick,
  outlineHeadings,
  outgoingLinks,
  rightPanelView,
  setLinkContextMenu
}: AppRightPanelProps): ReactElement {
  const t = useT();

  return (
    <aside
      aria-hidden={!isOpen}
      className={`right-panel${isOpen ? "" : " right-panel--closed"}`}
    >
      <div className="sidebar-header">
        <div className="pane-heading">
          {rightPanelView === "outline"
            ? t("pane.outline")
            : t("pane.links")}
        </div>
      </div>
      <div className={`sidebar-body right-panel-content right-panel-content--${rightPanelView}`}>
      {rightPanelView === "outline" ? (
        outlineHeadings.length > 0 ? (
          <ul className="outline-list">
            {outlineHeadings.map((heading, index) => (
              <li
                className={`outline-item outline-item--h${heading.level}`}
                key={index}
                onClick={() => onOutlineHeadingClick(heading.text)}
                title={heading.text}
              >
                {heading.text}
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
            {outgoingLinks.length > 0 ? (
              <ul className="links-list">
                {outgoingLinks.map((link, index) => (
                  <li className="links-list-item" key={`${link.wikiLink.raw}-${index}`}>
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
