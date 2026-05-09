import { EditorSelection } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { useState } from "react";
import type { ReactElement } from "react";

import { useT } from "../i18n";

interface ToolbarProps {
  viewRef: React.RefObject<EditorView | null>;
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type BlockIdFactory = () => string;

function wrapSelection(view: EditorView, before: string, after: string, placeholder: string): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to);
    const text = selected.length > 0 ? selected : placeholder;

    return {
      changes: { from: range.from, to: range.to, insert: `${before}${text}${after}` },
      range: EditorSelection.range(
        range.from + before.length,
        range.from + before.length + text.length
      )
    };
  });

  view.dispatch(changes);
  view.focus();
}

function insertAtLineStart(view: EditorView, prefix: string, placeholder: string): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const insert = `${prefix}${line.text.length > 0 ? line.text : placeholder}`;

    return {
      changes: { from: line.from, to: line.to, insert },
      range: EditorSelection.range(line.from + prefix.length, line.from + insert.length)
    };
  });

  view.dispatch(changes);
  view.focus();
}

function insertBlock(view: EditorView, text: string): void {
  const { state } = view;
  const pos = state.selection.main.from;
  const line = state.doc.lineAt(pos);
  const prefix = line.from > 0 ? "\n" : "";

  view.dispatch({
    changes: { from: line.to, insert: `${prefix}\n${text}\n` },
    selection: { anchor: line.to + prefix.length + 1 + text.length + 1 }
  });
  view.focus();
}

function hasBlockId(text: string): boolean {
  return /(?:^|\s)\^[A-Za-z0-9_-]+$/.test(text.trimEnd());
}

function findParagraphEndLineNumbers(state: EditorState): number[] {
  const lineNumbers = new Set<number>();
  const { doc } = state;

  for (const range of state.selection.ranges) {
    const fromLine = doc.lineAt(range.from);
    const toLine = doc.lineAt(range.to);

    if (range.empty) {
      let endLine = fromLine;

      while (endLine.number < doc.lines) {
        const nextLine = doc.line(endLine.number + 1);
        if (nextLine.text.trim() === "") break;
        endLine = nextLine;
      }

      lineNumbers.add(endLine.number);
      continue;
    }

    let paragraphEnd: number | null = null;

    for (let lineNumber = fromLine.number; lineNumber <= toLine.number; lineNumber += 1) {
      const line = doc.line(lineNumber);

      if (line.text.trim() === "") {
        if (paragraphEnd !== null) lineNumbers.add(paragraphEnd);
        paragraphEnd = null;
        continue;
      }

      paragraphEnd = lineNumber;
    }

    if (paragraphEnd !== null) lineNumbers.add(paragraphEnd);
  }

  return [...lineNumbers].sort((a, b) => a - b);
}

export function insertBlockIds(view: EditorView, createId: BlockIdFactory = () => Math.random().toString(36).slice(2, 8)): void {
  const { state } = view;
  const changes = findParagraphEndLineNumbers(state)
    .map((lineNumber) => {
      const line = state.doc.line(lineNumber);
      if (hasBlockId(line.text)) return null;

      return {
        from: line.to,
        insert: `${line.text.trim().length > 0 ? " " : ""}^${createId()}`
      };
    })
    .filter((change): change is { from: number; insert: string } => change !== null);

  if (changes.length > 0) {
    view.dispatch({ changes });
  }

  view.focus();
}

export function Toolbar({ viewRef }: ToolbarProps): ReactElement {
  const t = useT();
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [tableRows, setTableRows] = useState("3");
  const [tableCols, setTableCols] = useState("3");

  const placeholderText = t("toolbar.placeholderText");
  const placeholderLinkText = t("toolbar.placeholderLinkText");
  const getView = (): EditorView | null => viewRef.current;

  const handleBold = (): void => {
    const view = getView();
    if (!view) return;
    wrapSelection(view, "**", "**", placeholderText);
  };

  const handleItalic = (): void => {
    const view = getView();
    if (!view) return;
    wrapSelection(view, "*", "*", placeholderText);
  };

  const handleStrikethrough = (): void => {
    const view = getView();
    if (!view) return;
    wrapSelection(view, "~~", "~~", placeholderText);
  };

  const handleHighlight = (): void => {
    const view = getView();
    if (!view) return;
    wrapSelection(view, "==", "==", placeholderText);
  };

  const handleUnderline = (): void => {
    const view = getView();
    if (!view) return;
    wrapSelection(view, "<u>", "</u>", placeholderText);
  };

  const handleInlineCode = (): void => {
    const view = getView();
    if (!view) return;
    wrapSelection(view, "`", "`", placeholderText);
  };

  const handleHeading = (level: HeadingLevel): void => {
    const view = getView();
    if (!view) return;
    insertAtLineStart(view, "#".repeat(level) + " ", placeholderText);
    setShowHeadingMenu(false);
  };

  const handleBlockquote = (): void => {
    const view = getView();
    if (!view) return;
    insertAtLineStart(view, "> ", placeholderText);
  };

  const handleCodeBlock = (): void => {
    const view = getView();
    if (!view) return;
    insertBlock(view, "```\n\n```");
  };

  const handleHorizontalRule = (): void => {
    const view = getView();
    if (!view) return;
    insertBlock(view, "---");
  };

  const handleBulletList = (): void => {
    const view = getView();
    if (!view) return;
    insertAtLineStart(view, "- ", placeholderText);
  };

  const handleOrderedList = (): void => {
    const view = getView();
    if (!view) return;
    insertAtLineStart(view, "1. ", placeholderText);
  };

  const handleCheckbox = (): void => {
    const view = getView();
    if (!view) return;
    insertAtLineStart(view, "- [ ] ", placeholderText);
  };

  const handleLink = (): void => {
    const view = getView();
    if (!view) return;
    const { state } = view;
    const selected = state.sliceDoc(state.selection.main.from, state.selection.main.to);
    const text = selected || placeholderLinkText;

    if (linkUrl) {
      view.dispatch({
        changes: {
          from: state.selection.main.from,
          to: state.selection.main.to,
          insert: `[${text}](${linkUrl})`
        }
      });
      view.focus();
      setShowLinkDialog(false);
      setLinkUrl("");
    } else {
      setShowLinkDialog(true);
    }
  };

  const handleLinkSubmit = (): void => {
    const view = getView();
    if (!view) return;
    const { state } = view;
    const selected = state.sliceDoc(state.selection.main.from, state.selection.main.to);
    const text = selected || placeholderLinkText;

    view.dispatch({
      changes: {
        from: state.selection.main.from,
        to: state.selection.main.to,
        insert: `[${text}](${linkUrl || "URL"})`
      }
    });
    view.focus();
    setShowLinkDialog(false);
    setLinkUrl("");
  };

  const handleInternalLink = (): void => {
    const view = getView();
    if (!view) return;
    const { state } = view;
    const pos = state.selection.main.head;

    view.dispatch({
      changes: { from: pos, insert: "[[]]" },
      selection: { anchor: pos + 2 }
    });
    view.focus();
  };

  const handleBlockId = (): void => {
    const view = getView();
    if (!view) return;
    insertBlockIds(view);
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
    setShowTableDialog(false);
    view.focus();
  };

  return (
    <div
      className="toolbar"
      onMouseDownCapture={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("input, select, textarea")) return;
        event.preventDefault();
      }}
    >
      <div className="toolbar-group">
        <button className="toolbar-btn" data-tooltip={t("toolbar.bold")} onClick={handleBold} title={t("toolbar.bold")} type="button">
          <strong>B</strong>
        </button>
        <button className="toolbar-btn" data-tooltip={t("toolbar.italic")} onClick={handleItalic} title={t("toolbar.italic")} type="button">
          <em>I</em>
        </button>
        <button className="toolbar-btn" data-tooltip={t("toolbar.strikethrough")} onClick={handleStrikethrough} title={t("toolbar.strikethrough")} type="button">
          S̶
        </button>
        <button className="toolbar-btn" data-tooltip={t("toolbar.highlight")} onClick={handleHighlight} title={t("toolbar.highlight")} type="button">
          H
        </button>
        <button className="toolbar-btn" data-tooltip={t("toolbar.underline")} onClick={handleUnderline} title={t("toolbar.underline")} type="button">
          <u>U</u>
        </button>
        <button className="toolbar-btn" data-tooltip={t("toolbar.inlineCode")} onClick={handleInlineCode} title={t("toolbar.inlineCode")} type="button">
          `code`
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <div className="toolbar-dropdown">
          <button
            className="toolbar-btn"
            data-tooltip={t("toolbar.heading")}
            onClick={() => setShowHeadingMenu((v) => !v)}
            title={t("toolbar.heading")}
            type="button"
          >
            H
          </button>
          {showHeadingMenu ? (
            <div className="toolbar-dropdown-menu">
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
        <button className="toolbar-btn" data-tooltip={t("toolbar.blockquote")} onClick={handleBlockquote} title={t("toolbar.blockquote")} type="button">
          &ldquo;
        </button>
        <button className="toolbar-btn" data-tooltip={t("toolbar.codeBlock")} onClick={handleCodeBlock} title={t("toolbar.codeBlock")} type="button">
          {"</>"}
        </button>
        <button className="toolbar-btn" data-tooltip={t("toolbar.horizontalRule")} onClick={handleHorizontalRule} title={t("toolbar.horizontalRule")} type="button">
          —
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button className="toolbar-btn" data-tooltip={t("toolbar.bulletList")} onClick={handleBulletList} title={t("toolbar.bulletList")} type="button">
          •
        </button>
        <button className="toolbar-btn" data-tooltip={t("toolbar.orderedList")} onClick={handleOrderedList} title={t("toolbar.orderedList")} type="button">
          1.
        </button>
        <button className="toolbar-btn" data-tooltip={t("toolbar.checkbox")} onClick={handleCheckbox} title={t("toolbar.checkbox")} type="button">
          ☐
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <div className="toolbar-inline-dialog-wrap">
          <button className="toolbar-btn" data-tooltip={t("toolbar.link")} onClick={handleLink} title={t("toolbar.link")} type="button">
            Link
          </button>
          {showLinkDialog ? (
            <div className="toolbar-inline-dialog">
              <input
                autoFocus
                className="toolbar-input"
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLinkSubmit();
                  if (e.key === "Escape") {
                    setShowLinkDialog(false);
                    setLinkUrl("");
                  }
                }}
                placeholder="URL"
                value={linkUrl}
              />
              <button className="toolbar-btn" onClick={handleLinkSubmit} type="button">
                {t("toolbar.insert")}
              </button>
            </div>
          ) : null}
        </div>
        <button className="toolbar-btn" data-tooltip={t("toolbar.internalLink")} onClick={handleInternalLink} title={t("toolbar.internalLink")} type="button">
          [[
        </button>
        <button className="toolbar-btn" data-tooltip={t("toolbar.blockId")} onClick={handleBlockId} title={t("toolbar.blockId")} type="button">
          ^ID
        </button>
        <div className="toolbar-inline-dialog-wrap">
          <button
            className="toolbar-btn"
            data-tooltip={t("toolbar.table")}
            onClick={() => setShowTableDialog((v) => !v)}
            title={t("toolbar.table")}
            type="button"
          >
            {t("toolbar.tableShort")}
          </button>
          {showTableDialog ? (
            <div className="toolbar-inline-dialog">
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
              <button className="toolbar-btn" onClick={handleTableSubmit} type="button">
                {t("toolbar.insert")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
