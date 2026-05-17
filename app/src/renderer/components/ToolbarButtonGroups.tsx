import type { ReactElement, ReactNode } from "react";

import type { Translator } from "../i18n";
import {
  TOOLBAR_HEADING_LEVELS,
  toolbarPanelClass,
  type ToolbarPanel
} from "../toolbarModel";
import type { HeadingLevel } from "../toolbarCommands";

interface ToolbarButtonProps {
  children: ReactNode;
  label: string;
  onClick: () => void;
  tooltip?: string;
}

function ToolbarButton({ children, label, onClick, tooltip = label }: ToolbarButtonProps): ReactElement {
  return (
    <button aria-label={label} className="toolbar-btn" data-tooltip={tooltip} onClick={onClick} title={tooltip} type="button">
      {children}
    </button>
  );
}

function ToolbarIcon({ children }: { children: ReactNode }): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      {children}
    </svg>
  );
}

export interface ToolbarInlineFormattingGroupProps {
  onBold: () => void;
  onHighlight: () => void;
  onInlineCode: () => void;
  onItalic: () => void;
  onStrikethrough: () => void;
  onUnderline: () => void;
  t: Translator;
}

export function ToolbarInlineFormattingGroup({
  onBold,
  onHighlight,
  onInlineCode,
  onItalic,
  onStrikethrough,
  onUnderline,
  t
}: ToolbarInlineFormattingGroupProps): ReactElement {
  return (
    <div className="toolbar-group">
      <ToolbarButton label={t("toolbar.bold")} onClick={onBold}>
        <ToolbarIcon>
          <path strokeLinejoin="round" d="M6.75 3.744h-.753v8.25h7.125a4.125 4.125 0 0 0 0-8.25H6.75Zm0 0v.38m0 16.122h6.747a4.5 4.5 0 0 0 0-9.001h-7.5v9h.753Zm0 0v-.37m0-15.751h6a3.75 3.75 0 1 1 0 7.5h-6m0-7.5v7.5m0 0v8.25m0-8.25h6.375a4.125 4.125 0 0 1 0 8.25H6.75m.747-15.38h4.875a3.375 3.375 0 0 1 0 6.75H7.497v-6.75Zm0 7.5h5.25a3.75 3.75 0 0 1 0 7.5h-5.25v-7.5Z" />
        </ToolbarIcon>
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.italic")} onClick={onItalic}>
        <ToolbarIcon>
          <path d="M5.248 20.246H9.05m0 0h3.696m-3.696 0 5.893-16.502m0 0h-3.697m3.697 0h3.803" />
        </ToolbarIcon>
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.strikethrough")} onClick={onStrikethrough}>
        S̶
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.highlight")} onClick={onHighlight}>
        <ToolbarIcon>
          <path d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
        </ToolbarIcon>
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.underline")} onClick={onUnderline}>
        <ToolbarIcon>
          <path d="M17.995 3.744v7.5a6 6 0 1 1-12 0v-7.5m-2.25 16.502h16.5" />
        </ToolbarIcon>
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.inlineCode")} onClick={onInlineCode}>
        `code`
      </ToolbarButton>
    </div>
  );
}

export interface ToolbarBlockFormattingGroupProps {
  closingPanel: ToolbarPanel | null;
  onBlockquote: () => void;
  onCodeBlock: () => void;
  onHeading: (level: HeadingLevel) => void;
  onHorizontalRule: () => void;
  onToggleHeadingMenu: () => void;
  showHeadingMenu: boolean;
  t: Translator;
}

export function ToolbarBlockFormattingGroup({
  closingPanel,
  onBlockquote,
  onCodeBlock,
  onHeading,
  onHorizontalRule,
  onToggleHeadingMenu,
  showHeadingMenu,
  t
}: ToolbarBlockFormattingGroupProps): ReactElement {
  return (
    <div className="toolbar-group">
      <div className="toolbar-dropdown">
        <ToolbarButton label={t("toolbar.heading")} onClick={onToggleHeadingMenu}>
          H
        </ToolbarButton>
        {showHeadingMenu ? (
          <div className={toolbarPanelClass("toolbar-dropdown-menu", "heading", closingPanel)}>
            {TOOLBAR_HEADING_LEVELS.map((level) => (
              <button
                className="toolbar-dropdown-item"
                key={level}
                onClick={() => onHeading(level)}
                type="button"
              >
                H{level}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <ToolbarButton label={t("toolbar.blockquote")} onClick={onBlockquote}>
        <ToolbarIcon>
          <path d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </ToolbarIcon>
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.codeBlock")} onClick={onCodeBlock}>
        <ToolbarIcon>
          <path d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
        </ToolbarIcon>
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.horizontalRule")} onClick={onHorizontalRule}>
        —
      </ToolbarButton>
    </div>
  );
}

export interface ToolbarListGroupProps {
  onBulletList: () => void;
  onCheckbox: () => void;
  onOrderedList: () => void;
  t: Translator;
}

export function ToolbarListGroup({
  onBulletList,
  onCheckbox,
  onOrderedList,
  t
}: ToolbarListGroupProps): ReactElement {
  return (
    <div className="toolbar-group">
      <ToolbarButton label={t("toolbar.bulletList")} onClick={onBulletList}>
        <ToolbarIcon>
          <path d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </ToolbarIcon>
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.orderedList")} onClick={onOrderedList}>
        <ToolbarIcon>
          <path d="M8.242 5.992h12m-12 6.003H20.24m-12 5.999h12M4.117 7.495v-3.75H2.99m1.125 3.75H2.99m1.125 0H5.24m-1.92 2.577a1.125 1.125 0 1 1 1.591 1.59l-1.83 1.83h2.16M2.99 15.745h1.125a1.125 1.125 0 0 1 0 2.25H3.74m0-.002h.375a1.125 1.125 0 0 1 0 2.25H2.99" />
        </ToolbarIcon>
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.checkbox")} onClick={onCheckbox}>
        ☐
      </ToolbarButton>
    </div>
  );
}

export interface ToolbarInsertGroupProps {
  closingPanel: ToolbarPanel | null;
  linkUrl: string;
  onBlockId: () => void;
  onCloseLinkDialog: (afterClose?: () => void) => void;
  onInternalLink: () => void;
  onLink: () => void;
  onLinkSubmit: () => void;
  onSetLinkUrl: (value: string) => void;
  onSetTableCols: (value: string) => void;
  onSetTableRows: (value: string) => void;
  onTableSubmit: () => void;
  onToggleTableDialog: () => void;
  showLinkDialog: boolean;
  showTableDialog: boolean;
  t: Translator;
  tableCols: string;
  tableRows: string;
}

export function ToolbarInsertGroup({
  closingPanel,
  linkUrl,
  onBlockId,
  onCloseLinkDialog,
  onInternalLink,
  onLink,
  onLinkSubmit,
  onSetLinkUrl,
  onSetTableCols,
  onSetTableRows,
  onTableSubmit,
  onToggleTableDialog,
  showLinkDialog,
  showTableDialog,
  t,
  tableCols,
  tableRows
}: ToolbarInsertGroupProps): ReactElement {
  return (
    <div className="toolbar-group">
      <div className="toolbar-inline-dialog-wrap">
        <ToolbarButton label={t("toolbar.markdownLink")} onClick={onLink} tooltip={t("toolbar.link")}>
          Link
        </ToolbarButton>
        {showLinkDialog ? (
          <div className={toolbarPanelClass("toolbar-inline-dialog", "link", closingPanel)}>
            <input
              autoFocus
              className="toolbar-input"
              onChange={(event) => onSetLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onLinkSubmit();
                if (event.key === "Escape") {
                  onCloseLinkDialog(() => onSetLinkUrl(""));
                }
              }}
              placeholder="URL"
              value={linkUrl}
            />
            <button aria-label={t("toolbar.insert")} className="toolbar-btn" onClick={onLinkSubmit} type="button">
              {t("toolbar.insert")}
            </button>
          </div>
        ) : null}
      </div>
      <ToolbarButton label={t("toolbar.internalLink")} onClick={onInternalLink}>
        [[
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.blockId")} onClick={onBlockId}>
        ^ID
      </ToolbarButton>
      <div className="toolbar-inline-dialog-wrap">
        <ToolbarButton label={t("toolbar.table")} onClick={onToggleTableDialog}>
          <ToolbarIcon>
            <path d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
          </ToolbarIcon>
        </ToolbarButton>
        {showTableDialog ? (
          <div className={toolbarPanelClass("toolbar-inline-dialog", "table", closingPanel)}>
            <input
              className="toolbar-input toolbar-input--narrow"
              onChange={(event) => onSetTableRows(event.target.value)}
              placeholder={t("toolbar.rows")}
              type="number"
              value={tableRows}
            />
            <span>×</span>
            <input
              className="toolbar-input toolbar-input--narrow"
              onChange={(event) => onSetTableCols(event.target.value)}
              placeholder={t("toolbar.columns")}
              type="number"
              value={tableCols}
            />
            <button aria-label={t("toolbar.insert")} className="toolbar-btn" onClick={onTableSubmit} type="button">
              {t("toolbar.insert")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
