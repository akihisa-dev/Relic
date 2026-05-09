import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
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

function findTableBlocks(view: EditorView): TableBlock[] {
  const blocks: TableBlock[] = [];
  const { doc } = view.state;
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
  constructor(
    private readonly view: EditorView,
    private readonly block: TableBlock
  ) {
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
            this.button("+", () => this.insertCol(colIndex + 1)),
            this.button("x", () => this.deleteCol(colIndex))
          );
          td.append(controls);
        }
        tr.append(td);
      });

      if (rowIndex > 0) {
        const controlsCell = document.createElement("td");
        controlsCell.className = "cm-live-table-row-actions";
        controlsCell.append(
          this.button("+", () => this.insertRow(rowIndex + 1)),
          this.button("x", () => this.deleteRow(rowIndex))
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
    addRow.addEventListener("click", () => this.insertRow(this.block.rows.length));
    wrapper.append(addRow);

    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  private update(rows: string[][]): void {
    this.view.dispatch({
      changes: {
        from: this.block.from,
        to: this.block.to,
        insert: formatTable(rows)
      }
    });
    this.view.focus();
  }

  private insertRow(index: number): void {
    const colCount = Math.max(...this.block.rows.map((row) => row.length), 1);
    const rows = [...this.block.rows];
    rows.splice(index, 0, Array.from({ length: colCount }, () => ""));
    this.update(rows);
  }

  private deleteRow(index: number): void {
    if (this.block.rows.length <= 2) return;
    this.update(this.block.rows.filter((_, rowIndex) => rowIndex !== index));
  }

  private insertCol(index: number): void {
    this.update(this.block.rows.map((row) => {
      const next = [...row];
      next.splice(index, 0, "");
      return next;
    }));
  }

  private deleteCol(index: number): void {
    const colCount = Math.max(...this.block.rows.map((row) => row.length), 1);
    if (colCount <= 1) return;
    this.update(this.block.rows.map((row) => row.filter((_, colIndex) => colIndex !== index)));
  }
}

export function buildLivePreviewDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const doc = state.doc;
  const editorHasFocus = typeof view.hasFocus === "boolean" ? view.hasFocus : true;

  const cursorLines = new Set<number>();
  if (editorHasFocus) {
    for (const range of state.selection.ranges) {
      const fromLine = doc.lineAt(range.from).number;
      const toLine = doc.lineAt(range.to).number;
      for (let l = fromLine; l <= toLine; l++) cursorLines.add(l);
    }
  }

  function isOnCursorLine(from: number, to: number): boolean {
    const start = doc.lineAt(from).number;
    const end = doc.lineAt(to).number;
    for (let l = start; l <= end; l++) {
      if (cursorLines.has(l)) return true;
    }
    return false;
  }

  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const tableBlocks = findTableBlocks(view);

  function addReplace(from: number, to: number) {
    if (from < to) ranges.push({ from, to, deco: Decoration.replace({}) });
  }

  function addMark(from: number, to: number, cls: string) {
    if (from < to) ranges.push({ from, to, deco: Decoration.mark({ class: cls }) });
  }

  const tree = syntaxTree(state);

  for (const { from: visFrom, to: visTo } of view.visibleRanges) {
    tree.iterate({
      from: visFrom,
      to: visTo,
      enter(node) {
        const { from, to, name } = node;
        if (isOnCursorLine(from, to)) return false;
        if (tableBlocks.some((block) => from >= block.from && to <= block.to)) return false;

        switch (name) {
          case "ATXHeading1":
          case "ATXHeading2":
          case "ATXHeading3":
          case "ATXHeading4":
          case "ATXHeading5":
          case "ATXHeading6":
            addMark(from, to, `cm-live-h${name.slice(-1)}`);
            break;
          case "HeaderMark":
            // +1 to also hide the space after ##
            addReplace(from, Math.min(to + 1, doc.lineAt(from).to));
            return false;
          case "StrongEmphasis":
            addMark(from, to, "cm-live-bold");
            break;
          case "Emphasis":
            addMark(from, to, "cm-live-italic");
            break;
          case "EmphasisMark":
            addReplace(from, to);
            return false;
          case "Strikethrough":
            addMark(from, to, "cm-live-strike");
            break;
          case "StrikethroughMark":
            addReplace(from, to);
            return false;
          case "InlineCode":
            addMark(from, to, "cm-live-code");
            return false;
          case "FencedCode":
          case "CodeBlock":
            return false;
        }
      }
    });

    // ==highlight== via regex (Obsidian extension not in lezer tree)
    const visText = doc.sliceString(visFrom, visTo);
    const hlRe = /==([^=\n]+)==/g;
    let m: RegExpExecArray | null;
    while ((m = hlRe.exec(visText)) !== null) {
      const absFrom = visFrom + m.index;
      const absTo = absFrom + m[0].length;
      if (!isOnCursorLine(absFrom, absTo)) {
        addReplace(absFrom, absFrom + 2);
        addMark(absFrom + 2, absTo - 2, "cm-live-highlight");
        addReplace(absTo - 2, absTo);
      }
    }
  }

  for (const block of tableBlocks) {
    if (isOnCursorLine(block.from, block.to)) continue;
    ranges.push({
      from: block.from,
      to: block.to,
      deco: Decoration.replace({ widget: new TableWidget(view, block), block: true })
    });
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  return Decoration.set(
    ranges.map(({ from, to, deco }) => deco.range(from, to)),
    true
  );
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildLivePreviewDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
        this.decorations = buildLivePreviewDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

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
