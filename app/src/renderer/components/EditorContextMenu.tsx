import type { ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";

import type { EditorContextMenuState } from "../editorContextMenuModel";
import type { UseToolbarActionsResult } from "../hooks/useToolbarActions";
import { useT } from "../i18n";
import { TOOLBAR_HEADING_LEVELS, toolbarPanelClass } from "../toolbarModel";
import type { HeadingLevel } from "../toolbarCommands";

interface EditorContextMenuProps {
  contextMenu: EditorContextMenuState | null;
  markdownActions: UseToolbarActionsResult;
  onBeforeMarkdownAction: () => void;
  onClose: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => Promise<void> | void;
  onSelectAll: () => void;
}

export function EditorContextMenu({
  contextMenu,
  markdownActions,
  onBeforeMarkdownAction,
  onClose,
  onCopy,
  onCut,
  onPaste,
  onSelectAll
}: EditorContextMenuProps): ReactElement | null {
  const t = useT();

  if (!contextMenu) return null;

  const runMarkdownAction = (action: () => void, closeAfter = true): void => {
    onBeforeMarkdownAction();
    action();
    if (closeAfter) onClose();
  };

  const runHeadingAction = (level: HeadingLevel): void => runMarkdownAction(() => markdownActions.handleHeading(level));

  return createPortal(
    <div
      className="tab-context-menu editor-context-menu"
      role="menu"
      style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 1000 }}
    >
      <button
        className="tab-context-menu-item"
        onClick={() => {
          onCopy();
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        <CopyIcon />
        {t("editor.copy")}
      </button>
      <button
        className="tab-context-menu-item"
        onClick={() => {
          onCut();
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        <CutIcon />
        {t("editor.cut")}
      </button>
      <button
        className="tab-context-menu-item"
        onClick={async () => {
          await onPaste();
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        <PasteIcon />
        {t("editor.paste")}
      </button>
      <div className="tab-context-menu-separator" />
      <div className="editor-context-menu-section" role="group">
        <span className="editor-context-menu-label">{t("editor.formatting")}</span>
        <div className="editor-context-menu-grid editor-context-menu-grid--inline">
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleBold)}
            role="menuitem"
            type="button"
          >
            <BoldIcon />
            {t("toolbar.bold")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleItalic)}
            role="menuitem"
            type="button"
          >
            <ItalicIcon />
            {t("toolbar.italic")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleStrikethrough)}
            role="menuitem"
            type="button"
          >
            {t("toolbar.strikethrough")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleHighlight)}
            role="menuitem"
            type="button"
          >
            <HighlightIcon />
            {t("toolbar.highlight")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleUnderline)}
            role="menuitem"
            type="button"
          >
            <UnderlineIcon />
            {t("toolbar.underline")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleInlineCode)}
            role="menuitem"
            type="button"
          >
            {t("toolbar.inlineCode")}
          </button>
        </div>
      </div>
      <div className="tab-context-menu-separator" />
      <div className="editor-context-menu-section" role="group">
        <span className="editor-context-menu-label">{t("editor.blockFormatting")}</span>
        <div className="editor-context-menu-grid editor-context-menu-grid--heading">
          {TOOLBAR_HEADING_LEVELS.map((level) => (
            <button
              className="tab-context-menu-item"
              key={level}
              onClick={() => runHeadingAction(level)}
              role="menuitem"
              type="button"
            >
              H{level}
            </button>
          ))}
        </div>
      </div>
      <div className="editor-context-menu-section" role="group">
        <div className="editor-context-menu-grid">
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleBlockquote)}
            role="menuitem"
            type="button"
          >
            <BlockquoteIcon />
            {t("toolbar.blockquote")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleCodeBlock)}
            role="menuitem"
            type="button"
          >
            <CodeBlockIcon />
            {t("toolbar.codeBlock")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleHorizontalRule)}
            role="menuitem"
            type="button"
          >
            {t("toolbar.horizontalRule")}
          </button>
        </div>
      </div>
      <div className="tab-context-menu-separator" />
      <div className="editor-context-menu-section" role="group">
        <span className="editor-context-menu-label">{t("editor.listFormatting")}</span>
        <div className="editor-context-menu-grid">
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleBulletList)}
            role="menuitem"
            type="button"
          >
            <BulletListIcon />
            {t("toolbar.bulletList")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleOrderedList)}
            role="menuitem"
            type="button"
          >
            <OrderedListIcon />
            {t("toolbar.orderedList")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleCheckbox)}
            role="menuitem"
            type="button"
          >
            {t("toolbar.checkbox")}
          </button>
        </div>
      </div>
      <div className="tab-context-menu-separator" />
      <div className="editor-context-menu-section" role="group">
        <span className="editor-context-menu-label">{t("editor.insertFormatting")}</span>
        <button
          className="tab-context-menu-item"
          onClick={() => runMarkdownAction(markdownActions.handleLink, false)}
          role="menuitem"
          type="button"
        >
          {t("toolbar.markdownLink")}
        </button>
        {markdownActions.showLinkDialog ? (
          <div className={toolbarPanelClass("editor-context-menu-inline-dialog", "link", markdownActions.closingPanel)}>
            <input
              autoFocus
              className="editor-context-menu-input"
              onChange={(event) => markdownActions.setLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  runMarkdownAction(markdownActions.handleLinkSubmit);
                }
                if (event.key === "Escape") {
                  markdownActions.closeLinkDialog(() => markdownActions.setLinkUrl(""));
                }
              }}
              placeholder="URL"
              value={markdownActions.linkUrl}
            />
            <button
              className="tab-context-menu-item editor-context-menu-insert"
              onClick={() => runMarkdownAction(markdownActions.handleLinkSubmit)}
              role="menuitem"
              type="button"
            >
              {t("toolbar.insert")}
            </button>
          </div>
        ) : null}
        <button
          className="tab-context-menu-item"
          onClick={() => runMarkdownAction(markdownActions.handleInternalLink)}
          role="menuitem"
          type="button"
        >
          {t("toolbar.internalLink")}
        </button>
        <button
          className="tab-context-menu-item"
          onClick={() => runMarkdownAction(markdownActions.handleBlockId)}
          role="menuitem"
          type="button"
        >
          {t("toolbar.blockId")}
        </button>
        <button
          className="tab-context-menu-item"
          onClick={() => {
            onBeforeMarkdownAction();
            markdownActions.toggleTableDialog();
          }}
          role="menuitem"
          type="button"
        >
          <TableIcon />
          {t("toolbar.table")}
        </button>
        {markdownActions.showTableDialog ? (
          <div className={toolbarPanelClass("editor-context-menu-inline-dialog", "table", markdownActions.closingPanel)}>
            <input
              className="editor-context-menu-input editor-context-menu-input--number"
              onChange={(event) => markdownActions.setTableRows(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runMarkdownAction(markdownActions.handleTableSubmit);
                if (event.key === "Escape") markdownActions.closeTableDialog();
              }}
              placeholder={t("toolbar.rows")}
              type="number"
              value={markdownActions.tableRows}
            />
            <span className="editor-context-menu-multiply">×</span>
            <input
              className="editor-context-menu-input editor-context-menu-input--number"
              onChange={(event) => markdownActions.setTableCols(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runMarkdownAction(markdownActions.handleTableSubmit);
                if (event.key === "Escape") markdownActions.closeTableDialog();
              }}
              placeholder={t("toolbar.columns")}
              type="number"
              value={markdownActions.tableCols}
            />
            <button
              className="tab-context-menu-item editor-context-menu-insert"
              onClick={() => runMarkdownAction(markdownActions.handleTableSubmit)}
              role="menuitem"
              type="button"
            >
              {t("toolbar.insert")}
            </button>
          </div>
        ) : null}
      </div>
      <div className="tab-context-menu-separator" />
      <button
        className="tab-context-menu-item"
        onClick={() => {
          onSelectAll();
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        {t("editor.selectAll")}
      </button>
    </div>,
    document.body
  );
}

function MenuIcon({ children }: { children: ReactNode }): ReactElement {
  return (
    <svg aria-hidden="true" className="editor-context-menu-icon" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
      {children}
    </svg>
  );
}

function CopyIcon(): ReactElement {
  return (
    <MenuIcon>
      <path d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </MenuIcon>
  );
}

function CutIcon(): ReactElement {
  return (
    <MenuIcon>
      <path d="m7.848 8.25 1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887a2.165 2.165 0 0 0 1.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863 2.077-1.199m0-3.328a4.323 4.323 0 0 1 2.068-1.379l5.325-1.628a4.5 4.5 0 0 1 2.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.33 4.33 0 0 0 10.607 12m3.736 0 7.794 4.5-.802.215a4.5 4.5 0 0 1-2.48-.043l-5.326-1.629a4.324 4.324 0 0 1-2.068-1.379M14.343 12l-2.882 1.664" />
    </MenuIcon>
  );
}

function PasteIcon(): ReactElement {
  return (
    <MenuIcon>
      <path d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75" />
    </MenuIcon>
  );
}

function BoldIcon(): ReactElement {
  return (
    <MenuIcon>
      <path strokeLinejoin="round" d="M6.75 3.744h-.753v8.25h7.125a4.125 4.125 0 0 0 0-8.25H6.75Zm0 0v.38m0 16.122h6.747a4.5 4.5 0 0 0 0-9.001h-7.5v9h.753Zm0 0v-.37m0-15.751h6a3.75 3.75 0 1 1 0 7.5h-6m0-7.5v7.5m0 0v8.25m0-8.25h6.375a4.125 4.125 0 0 1 0 8.25H6.75m.747-15.38h4.875a3.375 3.375 0 0 1 0 6.75H7.497v-6.75Zm0 7.5h5.25a3.75 3.75 0 0 1 0 7.5h-5.25v-7.5Z" />
    </MenuIcon>
  );
}

function ItalicIcon(): ReactElement {
  return (
    <MenuIcon>
      <path d="M5.248 20.246H9.05m0 0h3.696m-3.696 0 5.893-16.502m0 0h-3.697m3.697 0h3.803" />
    </MenuIcon>
  );
}

function HighlightIcon(): ReactElement {
  return (
    <MenuIcon>
      <path d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
    </MenuIcon>
  );
}

function UnderlineIcon(): ReactElement {
  return (
    <MenuIcon>
      <path d="M17.995 3.744v7.5a6 6 0 1 1-12 0v-7.5m-2.25 16.502h16.5" />
    </MenuIcon>
  );
}

function BlockquoteIcon(): ReactElement {
  return (
    <MenuIcon>
      <path d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </MenuIcon>
  );
}

function CodeBlockIcon(): ReactElement {
  return (
    <MenuIcon>
      <path d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
    </MenuIcon>
  );
}

function BulletListIcon(): ReactElement {
  return (
    <MenuIcon>
      <path d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </MenuIcon>
  );
}

function OrderedListIcon(): ReactElement {
  return (
    <MenuIcon>
      <path d="M8.242 5.992h12m-12 6.003H20.24m-12 5.999h12M4.117 7.495v-3.75H2.99m1.125 3.75H2.99m1.125 0H5.24m-1.92 2.577a1.125 1.125 0 1 1 1.591 1.59l-1.83 1.83h2.16M2.99 15.745h1.125a1.125 1.125 0 0 1 0 2.25H3.74m0-.002h.375a1.125 1.125 0 0 1 0 2.25H2.99" />
    </MenuIcon>
  );
}

function TableIcon(): ReactElement {
  return (
    <MenuIcon>
      <path d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
    </MenuIcon>
  );
}
