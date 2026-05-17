import type { ReactElement } from "react";
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
            {t("toolbar.bold")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleItalic)}
            role="menuitem"
            type="button"
          >
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
            {t("toolbar.highlight")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleUnderline)}
            role="menuitem"
            type="button"
          >
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
            {t("toolbar.blockquote")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleCodeBlock)}
            role="menuitem"
            type="button"
          >
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
            {t("toolbar.bulletList")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => runMarkdownAction(markdownActions.handleOrderedList)}
            role="menuitem"
            type="button"
          >
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
