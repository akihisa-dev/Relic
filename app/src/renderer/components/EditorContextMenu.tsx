import type { ReactElement } from "react";
import { createPortal } from "react-dom";

import type { EditorContextMenuState } from "../editorContextMenuModel";
import type { UseToolbarActionsResult } from "../hooks/useToolbarActions";
import { useT } from "../i18n";
import { TOOLBAR_HEADING_LEVELS, toolbarPanelClass } from "../toolbarModel";
import type { HeadingLevel } from "../toolbarCommands";
import {
  BlockquoteIcon,
  BoldIcon,
  BulletListIcon,
  CheckboxIcon,
  CodeBlockIcon,
  CopyIcon,
  CutIcon,
  ExternalLinkIcon,
  HeadingIcon,
  HighlightIcon,
  HorizontalRuleIcon,
  InlineCodeIcon,
  ItalicIcon,
  LinkIcon,
  OrderedListIcon,
  PasteIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon
} from "./MarkdownActionIcons";

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

interface IconMenuButtonProps {
  icon: ReactElement;
  label: string;
  onClick: () => Promise<void> | void;
}

function IconMenuButton({ icon, label, onClick }: IconMenuButtonProps): ReactElement {
  return (
    <button
      aria-label={label}
      className="tab-context-menu-item editor-context-menu-icon-button"
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      role="menuitem"
      title={label}
      type="button"
    >
      {icon}
      <span aria-hidden="true" className="editor-context-menu-tooltip">
        {label}
      </span>
    </button>
  );
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
      <div className="editor-context-menu-grid editor-context-menu-grid--clipboard" role="group">
        <IconMenuButton
          icon={<CopyIcon className="editor-context-menu-icon" size={16} />}
          label={t("editor.copy")}
          onClick={() => {
            onCopy();
            onClose();
          }}
        />
        <IconMenuButton
          icon={<CutIcon className="editor-context-menu-icon" size={16} />}
          label={t("editor.cut")}
          onClick={() => {
            onCut();
            onClose();
          }}
        />
        <IconMenuButton
          icon={<PasteIcon className="editor-context-menu-icon" size={16} />}
          label={t("editor.paste")}
          onClick={async () => {
            await onPaste();
            onClose();
          }}
        />
      </div>
      <div className="tab-context-menu-separator" />
      <div className="editor-context-menu-section" role="group">
        <div className="editor-context-menu-grid editor-context-menu-grid--inline">
          <IconMenuButton icon={<BoldIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.bold")} onClick={() => runMarkdownAction(markdownActions.handleBold)} />
          <IconMenuButton icon={<ItalicIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.italic")} onClick={() => runMarkdownAction(markdownActions.handleItalic)} />
          <IconMenuButton icon={<StrikethroughIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.strikethrough")} onClick={() => runMarkdownAction(markdownActions.handleStrikethrough)} />
          <IconMenuButton icon={<HighlightIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.highlight")} onClick={() => runMarkdownAction(markdownActions.handleHighlight)} />
          <IconMenuButton icon={<UnderlineIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.underline")} onClick={() => runMarkdownAction(markdownActions.handleUnderline)} />
          <IconMenuButton icon={<InlineCodeIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.inlineCode")} onClick={() => runMarkdownAction(markdownActions.handleInlineCode)} />
        </div>
      </div>
      <div className="tab-context-menu-separator" />
      <div className="editor-context-menu-section" role="group">
        <div className="editor-context-menu-grid editor-context-menu-grid--heading">
          {TOOLBAR_HEADING_LEVELS.map((level) => (
            <IconMenuButton
              icon={<HeadingIcon className="editor-context-menu-icon" level={level} size={16} />}
              key={level}
              label={`H${level}`}
              onClick={() => runHeadingAction(level)}
            />
          ))}
        </div>
      </div>
      <div className="editor-context-menu-section" role="group">
        <div className="editor-context-menu-grid">
          <IconMenuButton icon={<BlockquoteIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.blockquote")} onClick={() => runMarkdownAction(markdownActions.handleBlockquote)} />
          <IconMenuButton icon={<CodeBlockIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.codeBlock")} onClick={() => runMarkdownAction(markdownActions.handleCodeBlock)} />
          <IconMenuButton icon={<HorizontalRuleIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.horizontalRule")} onClick={() => runMarkdownAction(markdownActions.handleHorizontalRule)} />
        </div>
      </div>
      <div className="tab-context-menu-separator" />
      <div className="editor-context-menu-section" role="group">
        <div className="editor-context-menu-grid">
          <IconMenuButton icon={<BulletListIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.bulletList")} onClick={() => runMarkdownAction(markdownActions.handleBulletList)} />
          <IconMenuButton icon={<OrderedListIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.orderedList")} onClick={() => runMarkdownAction(markdownActions.handleOrderedList)} />
          <IconMenuButton icon={<CheckboxIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.checkbox")} onClick={() => runMarkdownAction(markdownActions.handleCheckbox)} />
        </div>
      </div>
      <div className="tab-context-menu-separator" />
      <div className="editor-context-menu-section" role="group">
        <div className="editor-context-menu-grid editor-context-menu-grid--insert">
          <IconMenuButton
            icon={<ExternalLinkIcon className="editor-context-menu-icon" size={16} />}
            label={t("toolbar.markdownLink")}
            onClick={() => runMarkdownAction(markdownActions.handleLink, false)}
          />
          <IconMenuButton
            icon={<LinkIcon className="editor-context-menu-icon" size={16} />}
            label={t("toolbar.internalLink")}
            onClick={() => runMarkdownAction(markdownActions.handleInternalLink)}
          />
          <IconMenuButton
            icon={<TableIcon className="editor-context-menu-icon" size={16} />}
            label={t("toolbar.table")}
            onClick={() => {
              onBeforeMarkdownAction();
              markdownActions.toggleTableDialog();
            }}
          />
        </div>
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
        className="tab-context-menu-item editor-context-menu-text-item"
        onClick={() => {
          onSelectAll();
          onClose();
        }}
        onMouseDown={(event) => event.preventDefault()}
        role="menuitem"
        type="button"
      >
        {t("editor.selectAll")}
      </button>
    </div>,
    document.body
  );
}
