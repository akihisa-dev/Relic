import { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { useT } from "../i18n";
import {
  findToolbarTargetView,
  insertAtLineStart,
  insertBlock,
  insertBlockIds,
  insertInternalLink,
  insertMarkdownLink,
  type HeadingLevel,
  wrapSelection
} from "../toolbarCommands";

export { insertBlockIds } from "../toolbarCommands";

interface ToolbarProps {
  fallbackViewRef?: React.RefObject<EditorView | null>;
  onEditorAction?: () => void;
  viewRef: React.RefObject<EditorView | null>;
}

type ToolbarPanel = "heading" | "link" | "table";

export function Toolbar({ fallbackViewRef, onEditorAction, viewRef }: ToolbarProps): ReactElement {
  const t = useT();
  const lastTargetViewRef = useRef<EditorView | null>(null);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [closingPanel, setClosingPanel] = useState<ToolbarPanel | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [tableRows, setTableRows] = useState("3");
  const [tableCols, setTableCols] = useState("3");
  const closePanelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const placeholderText = t("toolbar.placeholderText");
  const placeholderLinkText = t("toolbar.placeholderLinkText");
  const getCandidateViews = (): EditorView[] => {
    const primaryView = viewRef.current;
    const fallbackView = fallbackViewRef?.current ?? null;

    return [primaryView, fallbackView].filter(
      (view, index, views): view is EditorView => view !== null && views.indexOf(view) === index
    );
  };

  const getView = (): EditorView | null => {
    return findToolbarTargetView(getCandidateViews(), lastTargetViewRef.current);
  };

  const rememberTargetView = (): void => {
    lastTargetViewRef.current = getView();
  };

  const closePanel = (panel: ToolbarPanel, close: () => void, afterClose?: () => void): void => {
    if (closePanelTimerRef.current) clearTimeout(closePanelTimerRef.current);
    setClosingPanel(panel);
    closePanelTimerRef.current = setTimeout(() => {
      close();
      afterClose?.();
      setClosingPanel(null);
      closePanelTimerRef.current = null;
    }, 160);
  };

  const closeHeadingMenu = (): void => closePanel("heading", () => setShowHeadingMenu(false));
  const closeLinkDialog = (afterClose?: () => void): void => closePanel("link", () => setShowLinkDialog(false), afterClose);
  const closeTableDialog = (): void => closePanel("table", () => setShowTableDialog(false));

  useEffect(() => {
    return () => {
      if (closePanelTimerRef.current) clearTimeout(closePanelTimerRef.current);
    };
  }, []);

  const handleBold = (): void => {
    const view = getView();
    if (!view) return;
    wrapSelection(view, "**", "**", placeholderText);
    onEditorAction?.();
  };

  const handleItalic = (): void => {
    const view = getView();
    if (!view) return;
    wrapSelection(view, "*", "*", placeholderText);
    onEditorAction?.();
  };

  const handleStrikethrough = (): void => {
    const view = getView();
    if (!view) return;
    wrapSelection(view, "~~", "~~", placeholderText);
    onEditorAction?.();
  };

  const handleHighlight = (): void => {
    const view = getView();
    if (!view) return;
    wrapSelection(view, "==", "==", placeholderText);
    onEditorAction?.();
  };

  const handleUnderline = (): void => {
    const view = getView();
    if (!view) return;
    wrapSelection(view, "<u>", "</u>", placeholderText);
    onEditorAction?.();
  };

  const handleInlineCode = (): void => {
    const view = getView();
    if (!view) return;
    wrapSelection(view, "`", "`", placeholderText);
    onEditorAction?.();
  };

  const handleHeading = (level: HeadingLevel): void => {
    const view = getView();
    if (!view) return;
    insertAtLineStart(view, "#".repeat(level) + " ", placeholderText);
    onEditorAction?.();
    closeHeadingMenu();
  };

  const handleBlockquote = (): void => {
    const view = getView();
    if (!view) return;
    insertAtLineStart(view, "> ", placeholderText);
    onEditorAction?.();
  };

  const handleCodeBlock = (): void => {
    const view = getView();
    if (!view) return;
    insertBlock(view, "```\n\n```");
    onEditorAction?.();
  };

  const handleHorizontalRule = (): void => {
    const view = getView();
    if (!view) return;
    insertBlock(view, "---");
    onEditorAction?.();
  };

  const handleBulletList = (): void => {
    const view = getView();
    if (!view) return;
    insertAtLineStart(view, "- ", placeholderText);
    onEditorAction?.();
  };

  const handleOrderedList = (): void => {
    const view = getView();
    if (!view) return;
    insertAtLineStart(view, "1. ", placeholderText);
    onEditorAction?.();
  };

  const handleCheckbox = (): void => {
    const view = getView();
    if (!view) return;
    insertAtLineStart(view, "- [ ] ", placeholderText);
    onEditorAction?.();
  };

  const handleLink = (): void => {
    const view = getView();
    if (!view) return;

    if (linkUrl) {
      insertMarkdownLink(view, linkUrl, placeholderLinkText);
      onEditorAction?.();
      closeLinkDialog(() => setLinkUrl(""));
    } else {
      setClosingPanel(null);
      setShowLinkDialog(true);
    }
  };

  const handleLinkSubmit = (): void => {
    const view = getView();
    if (!view) return;

    insertMarkdownLink(view, linkUrl || "URL", placeholderLinkText);
    onEditorAction?.();
    closeLinkDialog(() => setLinkUrl(""));
  };

  const handleInternalLink = (): void => {
    const view = getView();
    if (!view) return;
    insertInternalLink(view);
    onEditorAction?.();
  };

  const handleBlockId = (): void => {
    const view = getView();
    if (!view) return;
    insertBlockIds(view);
    onEditorAction?.();
  };

  const handleTableSubmit = (): void => {
    const view = getView();
    if (!view) return;
    const rows = Math.max(1, parseInt(tableRows, 10) || 3);
    const cols = Math.max(1, parseInt(tableCols, 10) || 3);

    const header = "| " + Array.from({ length: cols }, (_, i) => t("toolbar.tableColumn", { index: i + 1 })).join(" | ") + " |";
    const divider = "| " + Array.from({ length: cols }, () => "---").join(" | ") + " |";
    const row = "| " + Array.from({ length: cols }, () => "　").join(" | ") + " |";
    const tableRows_arr = Array.from({ length: rows }, () => row);
    const tableText = [header, divider, ...tableRows_arr].join("\n");

    insertBlock(view, tableText);
    onEditorAction?.();
    closeTableDialog();
    view.focus();
  };

  return (
    <div
      className="toolbar"
      onMouseDownCapture={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("input, select, textarea")) return;
        rememberTargetView();
        event.preventDefault();
      }}
    >
      <div className="toolbar-group">
        <button aria-label={t("toolbar.bold")} className="toolbar-btn" data-tooltip={t("toolbar.bold")} onClick={handleBold} title={t("toolbar.bold")} type="button">
          <strong>B</strong>
        </button>
        <button aria-label={t("toolbar.italic")} className="toolbar-btn" data-tooltip={t("toolbar.italic")} onClick={handleItalic} title={t("toolbar.italic")} type="button">
          <em>I</em>
        </button>
        <button aria-label={t("toolbar.strikethrough")} className="toolbar-btn" data-tooltip={t("toolbar.strikethrough")} onClick={handleStrikethrough} title={t("toolbar.strikethrough")} type="button">
          S̶
        </button>
        <button aria-label={t("toolbar.highlight")} className="toolbar-btn" data-tooltip={t("toolbar.highlight")} onClick={handleHighlight} title={t("toolbar.highlight")} type="button">
          H
        </button>
        <button aria-label={t("toolbar.underline")} className="toolbar-btn" data-tooltip={t("toolbar.underline")} onClick={handleUnderline} title={t("toolbar.underline")} type="button">
          <u>U</u>
        </button>
        <button aria-label={t("toolbar.inlineCode")} className="toolbar-btn" data-tooltip={t("toolbar.inlineCode")} onClick={handleInlineCode} title={t("toolbar.inlineCode")} type="button">
          `code`
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <div className="toolbar-dropdown">
          <button
            aria-label={t("toolbar.heading")}
            className="toolbar-btn"
            data-tooltip={t("toolbar.heading")}
            onClick={() => {
              if (showHeadingMenu) closeHeadingMenu();
              else {
                setClosingPanel(null);
                setShowHeadingMenu(true);
              }
            }}
            title={t("toolbar.heading")}
            type="button"
          >
            H
          </button>
          {showHeadingMenu ? (
            <div className={`toolbar-dropdown-menu${closingPanel === "heading" ? " toolbar-panel--closing" : ""}`}>
              {([1, 2, 3, 4, 5, 6] as HeadingLevel[]).map((level) => (
                <button
                  className="toolbar-dropdown-item"
                  key={level}
                  onClick={() => handleHeading(level)}
                  type="button"
                >
                  H{level}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button aria-label={t("toolbar.blockquote")} className="toolbar-btn" data-tooltip={t("toolbar.blockquote")} onClick={handleBlockquote} title={t("toolbar.blockquote")} type="button">
          &ldquo;
        </button>
        <button aria-label={t("toolbar.codeBlock")} className="toolbar-btn" data-tooltip={t("toolbar.codeBlock")} onClick={handleCodeBlock} title={t("toolbar.codeBlock")} type="button">
          {"</>"}
        </button>
        <button aria-label={t("toolbar.horizontalRule")} className="toolbar-btn" data-tooltip={t("toolbar.horizontalRule")} onClick={handleHorizontalRule} title={t("toolbar.horizontalRule")} type="button">
          —
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button aria-label={t("toolbar.bulletList")} className="toolbar-btn" data-tooltip={t("toolbar.bulletList")} onClick={handleBulletList} title={t("toolbar.bulletList")} type="button">
          •
        </button>
        <button aria-label={t("toolbar.orderedList")} className="toolbar-btn" data-tooltip={t("toolbar.orderedList")} onClick={handleOrderedList} title={t("toolbar.orderedList")} type="button">
          1.
        </button>
        <button aria-label={t("toolbar.checkbox")} className="toolbar-btn" data-tooltip={t("toolbar.checkbox")} onClick={handleCheckbox} title={t("toolbar.checkbox")} type="button">
          ☐
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <div className="toolbar-inline-dialog-wrap">
          <button aria-label={t("toolbar.markdownLink")} className="toolbar-btn" data-tooltip={t("toolbar.link")} onClick={handleLink} title={t("toolbar.link")} type="button">
            Link
          </button>
          {showLinkDialog ? (
            <div className={`toolbar-inline-dialog${closingPanel === "link" ? " toolbar-panel--closing" : ""}`}>
              <input
                autoFocus
                className="toolbar-input"
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLinkSubmit();
                  if (e.key === "Escape") {
                    closeLinkDialog(() => setLinkUrl(""));
                  }
                }}
                placeholder="URL"
                value={linkUrl}
              />
              <button aria-label={t("toolbar.insert")} className="toolbar-btn" onClick={handleLinkSubmit} type="button">
                {t("toolbar.insert")}
              </button>
            </div>
          ) : null}
        </div>
        <button aria-label={t("toolbar.internalLink")} className="toolbar-btn" data-tooltip={t("toolbar.internalLink")} onClick={handleInternalLink} title={t("toolbar.internalLink")} type="button">
          [[
        </button>
        <button aria-label={t("toolbar.blockId")} className="toolbar-btn" data-tooltip={t("toolbar.blockId")} onClick={handleBlockId} title={t("toolbar.blockId")} type="button">
          ^ID
        </button>
        <div className="toolbar-inline-dialog-wrap">
          <button
            aria-label={t("toolbar.table")}
            className="toolbar-btn"
            data-tooltip={t("toolbar.table")}
            onClick={() => {
              if (showTableDialog) closeTableDialog();
              else {
                setClosingPanel(null);
                setShowTableDialog(true);
              }
            }}
            title={t("toolbar.table")}
            type="button"
          >
            {t("toolbar.tableShort")}
          </button>
          {showTableDialog ? (
            <div className={`toolbar-inline-dialog${closingPanel === "table" ? " toolbar-panel--closing" : ""}`}>
              <input
                className="toolbar-input toolbar-input--narrow"
                onChange={(e) => setTableRows(e.target.value)}
                placeholder={t("toolbar.rows")}
                type="number"
                value={tableRows}
              />
              <span>×</span>
              <input
                className="toolbar-input toolbar-input--narrow"
                onChange={(e) => setTableCols(e.target.value)}
                placeholder={t("toolbar.columns")}
                type="number"
                value={tableCols}
              />
              <button aria-label={t("toolbar.insert")} className="toolbar-btn" onClick={handleTableSubmit} type="button">
                {t("toolbar.insert")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
