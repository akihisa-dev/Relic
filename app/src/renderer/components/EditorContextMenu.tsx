import type { ReactElement } from "react";
import { createPortal } from "react-dom";
import type { EditorView } from "@codemirror/view";

import type { EditorContextMenuState } from "../editorContextMenuModel";
import type { UseToolbarActionsResult } from "../hooks/useToolbarActions";
import { useT } from "../i18n";
import {
  buildToolbarTableMarkdown,
  normalizeToolbarTableSize,
  TOOLBAR_HEADING_LEVELS,
  toolbarPanelClass
} from "../toolbarModel";
import {
  insertAtLineStart,
  insertBlock,
  insertInternalLink,
  insertListAtSelectedLines,
  insertMarkdownLink,
  wrapSelection,
  type HeadingLevel
} from "../toolbarCommands";
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
  onAfterMarkdownAction?: () => void;
  onBeforeMarkdownAction: () => EditorView | null;
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
  onAfterMarkdownAction,
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
    markdownActions.setTargetView(onBeforeMarkdownAction());
    action();
    if (closeAfter) onClose();
  };

  const runEditorCommand = (command: (view: EditorView) => void, closeAfter = true): void => {
    const view = onBeforeMarkdownAction();
    if (!view) return;

    markdownActions.setTargetView(view);
    command(view);
    onAfterMarkdownAction?.();
    if (closeAfter) onClose();
  };

  const placeholderText = t("toolbar.placeholderText");
  const placeholderLinkText = t("toolbar.placeholderLinkText");
  const runHeadingAction = (level: HeadingLevel): void => {
    runEditorCommand((view) => insertAtLineStart(view, "#".repeat(level) + " ", placeholderText));
    markdownActions.closeHeadingMenu();
  };
  const runLinkSubmit = (): void => {
    runEditorCommand((view) => insertMarkdownLink(view, markdownActions.linkUrl || "URL", placeholderLinkText));
    markdownActions.closeLinkDialog(() => markdownActions.setLinkUrl(""));
  };
  const runTableSubmit = (): void => {
    const { cols, rows } = normalizeToolbarTableSize(markdownActions.tableRows, markdownActions.tableCols);
    runEditorCommand((view) => insertBlock(view, buildToolbarTableMarkdown(rows, cols, (index) => t("toolbar.tableColumn", { index }))));
    markdownActions.closeTableDialog();
  };

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
          <IconMenuButton icon={<BoldIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.bold")} onClick={() => runEditorCommand((view) => wrapSelection(view, "**", "**", placeholderText))} />
          <IconMenuButton icon={<HighlightIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.highlight")} onClick={() => runEditorCommand((view) => wrapSelection(view, "==", "==", placeholderText))} />
          <IconMenuButton
            icon={<LinkIcon className="editor-context-menu-icon" size={16} />}
            label={t("toolbar.internalLink")}
            onClick={() => runEditorCommand(insertInternalLink)}
          />
          <IconMenuButton
            icon={<ExternalLinkIcon className="editor-context-menu-icon" size={16} />}
            label={t("toolbar.markdownLink")}
            onClick={() => runMarkdownAction(markdownActions.handleLink, false)}
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
                  runLinkSubmit();
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
              onClick={runLinkSubmit}
              role="menuitem"
              type="button"
            >
              {t("toolbar.insert")}
            </button>
          </div>
        ) : null}
      </div>
      <div className="tab-context-menu-separator" />
      <div className="editor-context-menu-section" role="group">
        <div className="editor-context-menu-grid">
          <IconMenuButton icon={<BulletListIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.bulletList")} onClick={() => runEditorCommand((view) => insertListAtSelectedLines(view, "- ", placeholderText))} />
          <IconMenuButton icon={<OrderedListIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.orderedList")} onClick={() => runEditorCommand((view) => insertListAtSelectedLines(view, (index) => `${index + 1}. `, placeholderText))} />
          <IconMenuButton icon={<CheckboxIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.checkbox")} onClick={() => runEditorCommand((view) => insertListAtSelectedLines(view, "- [ ] ", placeholderText))} />
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
        <div className="editor-context-menu-grid">
          <IconMenuButton icon={<BlockquoteIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.blockquote")} onClick={() => runEditorCommand((view) => insertAtLineStart(view, "> ", placeholderText))} />
          <IconMenuButton icon={<CodeBlockIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.codeBlock")} onClick={() => runEditorCommand((view) => insertBlock(view, "```\n\n```"))} />
          <IconMenuButton icon={<HorizontalRuleIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.horizontalRule")} onClick={() => runEditorCommand((view) => insertBlock(view, "---"))} />
        </div>
      </div>
      <div className="tab-context-menu-separator" />
      <div className="editor-context-menu-section" role="group">
        <div className="editor-context-menu-grid editor-context-menu-grid--insert">
          <IconMenuButton
            icon={<TableIcon className="editor-context-menu-icon" size={16} />}
            label={t("toolbar.table")}
            onClick={() => {
              markdownActions.setTargetView(onBeforeMarkdownAction());
              markdownActions.toggleTableDialog();
            }}
          />
        </div>
        {markdownActions.showTableDialog ? (
          <div className={toolbarPanelClass("editor-context-menu-inline-dialog", "table", markdownActions.closingPanel)}>
            <input
              className="editor-context-menu-input editor-context-menu-input--number"
              onChange={(event) => markdownActions.setTableRows(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  runTableSubmit();
                }
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
                if (event.key === "Enter") runTableSubmit();
                if (event.key === "Escape") markdownActions.closeTableDialog();
              }}
              placeholder={t("toolbar.columns")}
              type="number"
              value={markdownActions.tableCols}
            />
            <button
              className="tab-context-menu-item editor-context-menu-insert"
              onClick={runTableSubmit}
              role="menuitem"
              type="button"
            >
              {t("toolbar.insert")}
            </button>
          </div>
        ) : null}
      </div>
      <div className="tab-context-menu-separator" />
      <div className="editor-context-menu-section" role="group">
        <div className="editor-context-menu-grid editor-context-menu-grid--inline">
          <IconMenuButton icon={<ItalicIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.italic")} onClick={() => runEditorCommand((view) => wrapSelection(view, "*", "*", placeholderText))} />
          <IconMenuButton icon={<StrikethroughIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.strikethrough")} onClick={() => runEditorCommand((view) => wrapSelection(view, "~~", "~~", placeholderText))} />
          <IconMenuButton icon={<UnderlineIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.underline")} onClick={() => runEditorCommand((view) => wrapSelection(view, "<u>", "</u>", placeholderText))} />
          <IconMenuButton icon={<InlineCodeIcon className="editor-context-menu-icon" size={16} />} label={t("toolbar.inlineCode")} onClick={() => runEditorCommand((view) => wrapSelection(view, "`", "`", placeholderText))} />
        </div>
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
