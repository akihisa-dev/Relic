import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState, StateField } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, lineNumbers } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

import type { EditorSettings } from "../../shared/ipc";

interface EditorProps {
  allFilePaths?: string[];
  content: string;
  onChange: (content: string) => void;
  settings: EditorSettings;
  typewriterMode?: boolean;
  viewRef?: React.MutableRefObject<EditorView | null>;
}

interface TableBlock {
  from: number;
  to: number;
  rows: string[][];
}

interface SourceRevealRange {
  from: number;
  to: number;
}

interface InlineMatch {
  from: number;
  to: number;
  contentFrom: number;
  contentTo: number;
  className: string;
  hideRanges: Array<{ from: number; to: number }>;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function formatTable(rows: string[][]): string {
  const colCount = Math.max(...rows.map((row) => row.length), 1);
  const normalized = rows.map((row) => Array.from({ length: colCount }, (_, i) => row[i] ?? ""));
  const divider = Array.from({ length: colCount }, () => "---");
  return [
    `| ${normalized[0].join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...normalized.slice(1).map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");
}

function findTableBlocks(state: EditorState): TableBlock[] {
  const blocks: TableBlock[] = [];
  const { doc } = state;
  let lineNumber = 1;

  while (lineNumber < doc.lines) {
    const headerLine = doc.line(lineNumber);
    const dividerLine = doc.line(lineNumber + 1);

    if (!headerLine.text.includes("|") || !isTableDivider(dividerLine.text)) {
      lineNumber += 1;
      continue;
    }

    const rows = [splitTableRow(headerLine.text)];
    let endLine = dividerLine;
    let cursor = lineNumber + 2;

    while (cursor <= doc.lines) {
      const rowLine = doc.line(cursor);
      if (!rowLine.text.includes("|") || rowLine.text.trim() === "") break;
      rows.push(splitTableRow(rowLine.text));
      endLine = rowLine;
      cursor += 1;
    }

    blocks.push({ from: headerLine.from, to: endLine.to, rows });
    lineNumber = cursor;
  }

  return blocks;
}

class TableWidget extends WidgetType {
  constructor(private readonly block: TableBlock) {
    super();
  }

  eq(other: TableWidget): boolean {
    return this.block.from === other.block.from && this.block.to === other.block.to;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-live-table";
    const table = document.createElement("table");
    const colCount = Math.max(...this.block.rows.map((row) => row.length), 1);

    this.block.rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      Array.from({ length: colCount }, (_, colIndex) => row[colIndex] ?? "").forEach((cell, colIndex) => {
        const td = document.createElement(rowIndex === 0 ? "th" : "td");
        td.textContent = cell || " ";
        if (rowIndex === 0) {
          const controls = document.createElement("span");
          controls.className = "cm-live-table-controls cm-live-table-controls--col";
          controls.append(
            this.button("+", (view) => this.insertCol(view, colIndex + 1)),
            this.button("x", (view) => this.deleteCol(view, colIndex))
          );
          td.append(controls);
        }
        tr.append(td);
      });

      if (rowIndex > 0) {
        const controlsCell = document.createElement("td");
        controlsCell.className = "cm-live-table-row-actions";
        controlsCell.append(
          this.button("+", (view) => this.insertRow(view, rowIndex + 1)),
          this.button("x", (view) => this.deleteRow(view, rowIndex))
        );
        tr.append(controlsCell);
      }

      table.append(tr);
    });

    wrapper.append(table);
    const addRow = document.createElement("button");
    addRow.className = "cm-live-table-add-row";
    addRow.type = "button";
    addRow.textContent = "+";
    addRow.title = "Add row";
    addRow.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const view = EditorView.findFromDOM(addRow);
      if (view) this.insertRow(view, this.block.rows.length);
    });
    wrapper.append(addRow);

    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }

  private button(label: string, onClick: (view: EditorView) => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const view = EditorView.findFromDOM(button);
      if (view) onClick(view);
    });
    return button;
  }

  private update(view: EditorView, rows: string[][]): void {
    view.dispatch({
      changes: {
        from: this.block.from,
        to: this.block.to,
        insert: formatTable(rows)
      }
    });
    view.focus();
  }

  private insertRow(view: EditorView, index: number): void {
    const colCount = Math.max(...this.block.rows.map((row) => row.length), 1);
    const rows = [...this.block.rows];
    rows.splice(index, 0, Array.from({ length: colCount }, () => ""));
    this.update(view, rows);
  }

  private deleteRow(view: EditorView, index: number): void {
    if (this.block.rows.length <= 2) return;
    this.update(view, this.block.rows.filter((_, rowIndex) => rowIndex !== index));
  }

  private insertCol(view: EditorView, index: number): void {
    this.update(view, this.block.rows.map((row) => {
      const next = [...row];
      next.splice(index, 0, "");
      return next;
    }));
  }

  private deleteCol(view: EditorView, index: number): void {
    const colCount = Math.max(...this.block.rows.map((row) => row.length), 1);
    if (colCount <= 1) return;
    this.update(view, this.block.rows.map((row) => row.filter((_, colIndex) => colIndex !== index)));
  }
}

function overlaps(from: number, to: number, ranges: Array<{ from: number; to: number }>): boolean {
  return ranges.some((range) => from < range.to && to > range.from);
}

function collectRegexMatches(
  text: string,
  regex: RegExp,
  createMatch: (match: RegExpExecArray) => InlineMatch | null
): InlineMatch[] {
  const matches: InlineMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const inlineMatch = createMatch(match);
    if (inlineMatch) matches.push(inlineMatch);
    if (match[0].length === 0) regex.lastIndex += 1;
  }

  return matches;
}

export function buildLivePreviewDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const doc = state.doc;
  const editorHasFocus = typeof view.hasFocus === "boolean" ? view.hasFocus : true;

  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const tableBlocks = findTableBlocks(state);
  const sourceRevealRanges: SourceRevealRange[] = [];

  function selectionTouches(from: number, to: number): boolean {
    if (!editorHasFocus) return false;

    return state.selection.ranges.some((range) => {
      if (range.empty) return range.from >= from && range.from <= to;
      return range.from <= to && range.to >= from;
    });
  }

  function addSourceReveal(from: number, to: number) {
    if (from < to && selectionTouches(from, to)) sourceRevealRanges.push({ from, to });
  }

  function shouldRevealSource(from: number, to: number): boolean {
    return sourceRevealRanges.some((range) => from >= range.from && to <= range.to);
  }

  function addReplace(from: number, to: number) {
    if (from < to && !shouldRevealSource(from, to)) ranges.push({ from, to, deco: Decoration.replace({}) });
  }

  function addMark(from: number, to: number, cls: string) {
    if (from < to) ranges.push({ from, to, deco: Decoration.mark({ class: cls }) });
  }

  function addInlineDecorations(lineFrom: number, text: string) {
    const occupied: Array<{ from: number; to: number }> = [];
    const matches: InlineMatch[] = [];

    matches.push(...collectRegexMatches(text, /`([^`\n]+)`/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: from + 1,
        contentTo: to - 1,
        className: "cm-live-code",
        hideRanges: [{ from, to: from + 1 }, { from: to - 1, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /\[([^\]\n]+)\]\(([^)\n]+)\)/g, (match) => {
      const from = lineFrom + match.index;
      const textFrom = from + 1;
      const textTo = textFrom + match[1].length;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: textFrom,
        contentTo: textTo,
        className: "cm-live-link",
        hideRanges: [{ from, to: from + 1 }, { from: textTo, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /\[\[([^\]\n]+)\]\]/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      const separatorIndex = match[1].lastIndexOf("|");
      const contentOffset = separatorIndex >= 0 ? 2 + separatorIndex + 1 : 2;
      const contentLength = separatorIndex >= 0 ? match[1].length - separatorIndex - 1 : match[1].length;
      const contentFrom = from + contentOffset;
      const contentTo = contentFrom + contentLength;
      const hideRanges = separatorIndex >= 0
        ? [{ from, to: contentFrom }, { from: to - 2, to }]
        : [{ from, to: from + 2 }, { from: to - 2, to }];
      return {
        from,
        to,
        contentFrom,
        contentTo,
        className: "cm-live-link",
        hideRanges
      };
    }));

    matches.push(...collectRegexMatches(text, /\*\*([^*\n]+)\*\*/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: from + 2,
        contentTo: to - 2,
        className: "cm-live-bold",
        hideRanges: [{ from, to: from + 2 }, { from: to - 2, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /__([^_\n]+)__/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: from + 2,
        contentTo: to - 2,
        className: "cm-live-bold",
        hideRanges: [{ from, to: from + 2 }, { from: to - 2, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /~~([^~\n]+)~~/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: from + 2,
        contentTo: to - 2,
        className: "cm-live-strike",
        hideRanges: [{ from, to: from + 2 }, { from: to - 2, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /==([^=\n]+)==/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: from + 2,
        contentTo: to - 2,
        className: "cm-live-highlight",
        hideRanges: [{ from, to: from + 2 }, { from: to - 2, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /(^|[^\*])\*([^*\n]+)\*(?!\*)/g, (match) => {
      const markerOffset = match[1].length;
      const from = lineFrom + match.index + markerOffset;
      const to = from + match[0].length - markerOffset;
      return {
        from,
        to,
        contentFrom: from + 1,
        contentTo: to - 1,
        className: "cm-live-italic",
        hideRanges: [{ from, to: from + 1 }, { from: to - 1, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /(^|[^_])_([^_\n]+)_(?!_)/g, (match) => {
      const markerOffset = match[1].length;
      const from = lineFrom + match.index + markerOffset;
      const to = from + match[0].length - markerOffset;
      return {
        from,
        to,
        contentFrom: from + 1,
        contentTo: to - 1,
        className: "cm-live-italic",
        hideRanges: [{ from, to: from + 1 }, { from: to - 1, to }]
      };
    }));

    matches.sort((a, b) => a.from - b.from || b.to - a.to);

    for (const match of matches) {
      if (overlaps(match.from, match.to, occupied)) continue;
      occupied.push({ from: match.from, to: match.to });
      addSourceReveal(match.from, match.to);
      addMark(match.contentFrom, match.contentTo, match.className);
      for (const hideRange of match.hideRanges) addReplace(hideRange.from, hideRange.to);
    }
  }

  function startsInsideFencedCode(lineNumber: number): boolean {
    let inFencedCode = false;

    for (let currentLine = 1; currentLine < lineNumber; currentLine += 1) {
      if (/^\s*```/.test(doc.line(currentLine).text)) inFencedCode = !inFencedCode;
    }

    return inFencedCode;
  }

  for (const { from: visFrom, to: visTo } of view.visibleRanges) {
    let lineNumber = doc.lineAt(visFrom).number;
    let inFencedCode = startsInsideFencedCode(lineNumber);

    while (lineNumber <= doc.lineAt(visTo).number) {
      const line = doc.line(lineNumber);
      const text = line.text;
      const tableBlock = tableBlocks.find((block) => line.from >= block.from && line.to <= block.to);

      if (/^\s*```/.test(text)) {
        inFencedCode = !inFencedCode;
        lineNumber += 1;
        continue;
      }

      if (tableBlock || inFencedCode) {
        lineNumber += 1;
        continue;
      }

      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(text);
      if (headingMatch) {
        const markerFrom = line.from;
        const contentFrom = line.from + headingMatch[1].length + 1;
        addSourceReveal(line.from, line.to);
        addMark(contentFrom, line.to, `cm-live-h${headingMatch[1].length}`);
        addReplace(markerFrom, contentFrom);
        addInlineDecorations(contentFrom, text.slice(contentFrom - line.from));
      } else {
        addInlineDecorations(line.from, text);
      }

      lineNumber += 1;
    }
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  return Decoration.set(
    ranges.map(({ from, to, deco }) => deco.range(from, to)),
    true
  );
}

export function buildTableDecorations(state: EditorState): DecorationSet {
  const ranges: { from: number; to: number; deco: Decoration }[] = [];

  function selectionInside(from: number, to: number): boolean {
    return state.selection.ranges.some((range) => {
      if (range.empty) return range.from > from && range.from < to;
      return range.from < to && range.to > from;
    });
  }

  for (const block of findTableBlocks(state)) {
    if (selectionInside(block.from, block.to)) continue;
    ranges.push({
      from: block.from,
      to: block.to,
      deco: Decoration.replace({ widget: new TableWidget(block), block: true })
    });
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  return Decoration.set(
    ranges.map(({ from, to, deco }) => deco.range(from, to)),
    true
  );
}

const livePreviewTableField = StateField.define<DecorationSet>({
  create: (state) => buildTableDecorations(state),
  update: (_decorations, transaction) => buildTableDecorations(transaction.state),
  provide: (field) => EditorView.decorations.from(field)
});

const livePreviewPlugin = EditorView.decorations.of((view) => buildLivePreviewDecorations(view));

const typewriterExtension = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate): void {
      if (!update.selectionSet && !update.docChanged) return;

      const { view } = update;
      const cursor = view.state.selection.main.head;
      const line = view.lineBlockAt(cursor);
      const scroller = view.scrollDOM;
      const target = line.top - scroller.clientHeight / 2 + line.height / 2;

      scroller.scrollTop = Math.max(0, target);
    }
  }
);

const fontFamilyMap: Record<EditorSettings["font"], string> = {
  mincho: '"Hiragino Mincho ProN", serif',
  mono: "Menlo, monospace",
  system: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif'
};

export function buildWikiLinkCompletionSource(allFilePaths: string[]) {
  const basenameMap = new Map<string, string[]>();

  for (const filePath of allFilePaths) {
    const basename = filePath.split("/").at(-1)?.replace(/\.md$/, "") ?? "";

    if (!basename) continue;

    if (!basenameMap.has(basename)) basenameMap.set(basename, []);

    basenameMap.get(basename)!.push(filePath);
  }

  return (context: CompletionContext): CompletionResult | null => {
    const before = context.matchBefore(/\[\[([^\]\n]*)$/);

    if (!before || (!context.explicit && before.text === "[[")) return null;

    const options: { apply: string; label: string }[] = [];

    for (const [basename, paths] of basenameMap) {
      if (paths.length === 1) {
        options.push({ apply: `${basename}]]`, label: basename });
      } else {
        for (const filePath of paths) {
          const label = filePath.replace(/\.md$/, "");
          options.push({ apply: `${label}]]`, label });
        }
      }
    }

    return {
      filter: true,
      from: before.from + 2,
      options
    };
  };
}

function buildExtensions(
  settings: EditorSettings,
  typewriterMode: boolean,
  onChangeRef: React.RefObject<(c: string) => void>,
  allFilePaths: string[]
) {
  return [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    markdown({ extensions: GFM }),
    autocompletion({ override: [buildWikiLinkCompletionSource(allFilePaths)] }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChangeRef.current!(update.state.doc.toString());
    }),
    EditorView.theme({
      "&": {
        fontFamily: fontFamilyMap[settings.font],
        fontSize: `${settings.fontSize}px`,
        lineHeight: String(settings.lineHeight),
        height: "100%"
      },
      ".cm-scroller": { overflow: "auto" },
      ".cm-content": {
        maxWidth: settings.maxWidth === "none" ? "none" : settings.maxWidth,
        margin: "0 auto",
        padding: "24px 32px"
      },
      ".cm-focused": { outline: "none" }
    }),
    EditorView.contentAttributes.of({ spellcheck: settings.spellCheck ? "true" : "false" }),
    ...(settings.showLineNumbers ? [lineNumbers()] : []),
    ...(typewriterMode ? [typewriterExtension] : []),
    livePreviewTableField,
    livePreviewPlugin
  ];
}

export function Editor({
  allFilePaths = [],
  content,
  onChange,
  settings,
  typewriterMode = false,
  viewRef
}: EditorProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const allFilePathsRef = useRef(allFilePaths);

  onChangeRef.current = onChange;
  allFilePathsRef.current = allFilePaths;

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = buildExtensions(settings, typewriterMode, onChangeRef, allFilePathsRef.current);
    const state = EditorState.create({ doc: content, extensions });
    const view = new EditorView({ state, parent: containerRef.current });

    internalViewRef.current = view;

    if (viewRef) viewRef.current = view;

    return () => {
      view.destroy();
      internalViewRef.current = null;
      if (viewRef) viewRef.current = null;
    };
    // content は初期値のみ使用。以降は onChange で管理する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 設定・タイプライターモード変更時にエディタを再生成
  useEffect(() => {
    const view = internalViewRef.current;

    if (!view) return;

    const currentContent = view.state.doc.toString();

    view.destroy();
    internalViewRef.current = null;

    if (!containerRef.current) return;

    const extensions = buildExtensions(settings, typewriterMode, onChangeRef, allFilePathsRef.current);
    const state = EditorState.create({ doc: currentContent, extensions });
    const nextView = new EditorView({ state, parent: containerRef.current });

    internalViewRef.current = nextView;

    if (viewRef) viewRef.current = nextView;
  }, [settings, typewriterMode, viewRef]);

  return <div className="cm-editor-container" ref={containerRef} />;
}
