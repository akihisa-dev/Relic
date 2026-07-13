import type { ReactElement, ReactNode } from "react";

import type { Translator } from "../i18nModel";
import {
  TOOLBAR_HEADING_LEVELS,
  toolbarPanelClass,
  type ToolbarPanel
} from "../toolbarModel";
import type { HeadingLevel } from "../toolbarCommands";
import {
  BlockquoteIcon,
  BoldIcon,
  BulletListIcon,
  CheckboxIcon,
  CodeBlockIcon,
  ExternalLinkIcon,
  HeadingIcon,
  HighlightIcon,
  HorizontalRuleIcon,
  InlineCodeIcon,
  ItalicIcon,
  LinkIcon,
  OrderedListIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon
} from "./MarkdownActionIcons";

interface ToolbarButtonProps {
  children: ReactNode;
  label: string;
  onClick: () => void;
  tooltip?: string;
}

function ToolbarButton({ children, label, onClick, tooltip = label }: ToolbarButtonProps): ReactElement {
  return (
    <button aria-label={label} className="toolbar-btn" data-tooltip={tooltip} onClick={onClick} type="button">
      {children}
    </button>
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
        <BoldIcon />
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.italic")} onClick={onItalic}>
        <ItalicIcon />
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.strikethrough")} onClick={onStrikethrough}>
        <StrikethroughIcon />
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.highlight")} onClick={onHighlight}>
        <HighlightIcon />
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.underline")} onClick={onUnderline}>
        <UnderlineIcon />
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.inlineCode")} onClick={onInlineCode}>
        <InlineCodeIcon />
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
          <HeadingIcon level={1} />
        </ToolbarButton>
        {showHeadingMenu ? (
          <div className={toolbarPanelClass("toolbar-dropdown-menu", "heading", closingPanel)}>
            {TOOLBAR_HEADING_LEVELS.map((level) => (
              <button
                className="toolbar-dropdown-item"
                key={level}
              onClick={() => onHeading(level)}
              aria-label={`H${level}`}
              data-tooltip={`H${level}`}
              type="button"
            >
                <HeadingIcon level={level} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <ToolbarButton label={t("toolbar.blockquote")} onClick={onBlockquote}>
        <BlockquoteIcon />
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.codeBlock")} onClick={onCodeBlock}>
        <CodeBlockIcon />
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.horizontalRule")} onClick={onHorizontalRule}>
        <HorizontalRuleIcon />
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
        <BulletListIcon />
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.orderedList")} onClick={onOrderedList}>
        <OrderedListIcon />
      </ToolbarButton>
      <ToolbarButton label={t("toolbar.checkbox")} onClick={onCheckbox}>
        <CheckboxIcon />
      </ToolbarButton>
    </div>
  );
}

export interface ToolbarInsertGroupProps {
  closingPanel: ToolbarPanel | null;
  linkUrl: string;
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
          <ExternalLinkIcon />
        </ToolbarButton>
        {showLinkDialog ? (
          <div className={toolbarPanelClass("toolbar-inline-dialog", "link", closingPanel)}>
            <input
              aria-label={t("toolbar.markdownLink")}
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
        <LinkIcon />
      </ToolbarButton>
      <div className="toolbar-inline-dialog-wrap">
        <ToolbarButton label={t("toolbar.table")} onClick={onToggleTableDialog}>
          <TableIcon />
        </ToolbarButton>
        {showTableDialog ? (
          <div className={toolbarPanelClass("toolbar-inline-dialog", "table", closingPanel)}>
            <input
              aria-label={t("toolbar.rows")}
              className="toolbar-input toolbar-input--narrow"
              onChange={(event) => onSetTableRows(event.target.value)}
              placeholder={t("toolbar.rows")}
              type="number"
              value={tableRows}
            />
            <span>×</span>
            <input
              aria-label={t("toolbar.columns")}
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
