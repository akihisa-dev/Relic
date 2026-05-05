import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { useState } from "react";
import type { ReactElement } from "react";

interface ToolbarProps {
  viewRef: React.RefObject<EditorView | null>;
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

function wrapSelection(view: EditorView, before: string, after: string): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to);
    const text = selected.length > 0 ? selected : "テキスト";

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

function insertAtLineStart(view: EditorView, prefix: string): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const insert = `${prefix}${line.text.length > 0 ? line.text : "テキスト"}`;

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

export function Toolbar({ viewRef }: ToolbarProps): ReactElement {
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [tableRows, setTableRows] = useState("3");
  const [tableCols, setTableCols] = useState("3");

  const view = viewRef.current;

  const handleBold = (): void => {
    if (!view) return;
    wrapSelection(view, "**", "**");
  };

  const handleItalic = (): void => {
    if (!view) return;
    wrapSelection(view, "*", "*");
  };

  const handleStrikethrough = (): void => {
    if (!view) return;
    wrapSelection(view, "~~", "~~");
  };

  const handleHighlight = (): void => {
    if (!view) return;
    wrapSelection(view, "==", "==");
  };

  const handleUnderline = (): void => {
    if (!view) return;
    wrapSelection(view, "<u>", "</u>");
  };

  const handleInlineCode = (): void => {
    if (!view) return;
    wrapSelection(view, "`", "`");
  };

  const handleHeading = (level: HeadingLevel): void => {
    if (!view) return;
    insertAtLineStart(view, "#".repeat(level) + " ");
    setShowHeadingMenu(false);
  };

  const handleBlockquote = (): void => {
    if (!view) return;
    insertAtLineStart(view, "> ");
  };

  const handleCodeBlock = (): void => {
    if (!view) return;
    insertBlock(view, "```\n\n```");
  };

  const handleHorizontalRule = (): void => {
    if (!view) return;
    insertBlock(view, "---");
  };

  const handleBulletList = (): void => {
    if (!view) return;
    insertAtLineStart(view, "- ");
  };

  const handleOrderedList = (): void => {
    if (!view) return;
    insertAtLineStart(view, "1. ");
  };

  const handleCheckbox = (): void => {
    if (!view) return;
    insertAtLineStart(view, "- [ ] ");
  };

  const handleLink = (): void => {
    if (!view) return;
    const { state } = view;
    const selected = state.sliceDoc(state.selection.main.from, state.selection.main.to);
    const text = selected || "リンクテキスト";

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
    if (!view) return;
    const { state } = view;
    const selected = state.sliceDoc(state.selection.main.from, state.selection.main.to);
    const text = selected || "リンクテキスト";

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
    if (!view) return;
    const { state } = view;
    const pos = state.selection.main.head;

    view.dispatch({ changes: { from: pos, insert: "[[" } });
    view.focus();
  };

  const handleBlockId = (): void => {
    if (!view) return;

    const { state } = view;
    const pos = state.selection.main.head;
    const line = state.doc.lineAt(pos);
    const id = Math.random().toString(36).slice(2, 8);

    view.dispatch({ changes: { from: line.to, insert: ` ^${id}` } });
    view.focus();
  };

  const handleTableSubmit = (): void => {
    if (!view) return;
    const rows = Math.max(1, parseInt(tableRows, 10) || 3);
    const cols = Math.max(1, parseInt(tableCols, 10) || 3);

    const header = "| " + Array.from({ length: cols }, (_, i) => `列${i + 1}`).join(" | ") + " |";
    const divider = "| " + Array.from({ length: cols }, () => "---").join(" | ") + " |";
    const row = "| " + Array.from({ length: cols }, () => "　").join(" | ") + " |";
    const tableRows_arr = Array.from({ length: rows }, () => row);
    const tableText = [header, divider, ...tableRows_arr].join("\n");

    insertBlock(view, tableText);
    setShowTableDialog(false);
    view.focus();
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleBold} title="太字" type="button">
          <strong>B</strong>
        </button>
        <button className="toolbar-btn" onClick={handleItalic} title="斜体" type="button">
          <em>I</em>
        </button>
        <button className="toolbar-btn" onClick={handleStrikethrough} title="打ち消し線" type="button">
          S̶
        </button>
        <button className="toolbar-btn" onClick={handleHighlight} title="ハイライト" type="button">
          H
        </button>
        <button className="toolbar-btn" onClick={handleUnderline} title="下線" type="button">
          <u>U</u>
        </button>
        <button className="toolbar-btn" onClick={handleInlineCode} title="インラインコード" type="button">
          `code`
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <div className="toolbar-dropdown">
          <button
            className="toolbar-btn"
            onClick={() => setShowHeadingMenu((v) => !v)}
            title="見出し"
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
        <button className="toolbar-btn" onClick={handleBlockquote} title="引用" type="button">
          &ldquo;
        </button>
        <button className="toolbar-btn" onClick={handleCodeBlock} title="コードブロック" type="button">
          {"</>"}
        </button>
        <button className="toolbar-btn" onClick={handleHorizontalRule} title="水平線" type="button">
          —
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleBulletList} title="箇条書き" type="button">
          •
        </button>
        <button className="toolbar-btn" onClick={handleOrderedList} title="番号付きリスト" type="button">
          1.
        </button>
        <button className="toolbar-btn" onClick={handleCheckbox} title="チェックボックス" type="button">
          ☐
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <div className="toolbar-inline-dialog-wrap">
          <button className="toolbar-btn" onClick={handleLink} title="リンク" type="button">
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
                挿入
              </button>
            </div>
          ) : null}
        </div>
        <button className="toolbar-btn" onClick={handleInternalLink} title="内部リンク" type="button">
          [[
        </button>
        <button className="toolbar-btn" onClick={handleBlockId} title="ブロックID挿入" type="button">
          ^ID
        </button>
        <div className="toolbar-inline-dialog-wrap">
          <button
            className="toolbar-btn"
            onClick={() => setShowTableDialog((v) => !v)}
            title="表"
            type="button"
          >
            表
          </button>
          {showTableDialog ? (
            <div className="toolbar-inline-dialog">
              <input
                className="toolbar-input toolbar-input--narrow"
                onChange={(e) => setTableRows(e.target.value)}
                placeholder="行"
                type="number"
                value={tableRows}
              />
              <span>×</span>
              <input
                className="toolbar-input toolbar-input--narrow"
                onChange={(e) => setTableCols(e.target.value)}
                placeholder="列"
                type="number"
                value={tableCols}
              />
              <button className="toolbar-btn" onClick={handleTableSubmit} type="button">
                挿入
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
