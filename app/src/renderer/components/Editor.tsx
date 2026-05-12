import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState, StateField, type Text } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, lineNumbers } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import * as yaml from "js-yaml";
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { createPortal } from "react-dom";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import { useT } from "../i18n";

interface EditorProps {
  allFilePaths?: string[];
  content: string;
  frontmatterCandidates?: Record<string, string[]>;
  onChange: (content: string) => void;
  onOpenLink?: (href: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  settings: EditorSettings;
  typewriterMode?: boolean;
  userDefinedFields?: UserDefinedField[];
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

interface ClickableLinkAtPosition {
  href?: string;
  heading?: string;
  target?: string;
  type: "markdown" | "wiki";
}

interface FrontmatterBlock {
  bodyFrom: number;
  data: Record<string, unknown>;
  endLine: number;
  from: number;
  startLine: number;
  to: number;
  yamlText: string;
}

const topLevelYamlFieldPattern = /^([^#\s][^:]*):(?:\s|$)/;

interface YamlFieldEntry {
  end: number;
  key: string;
  start: number;
}

function findYamlInlineComment(line: string): string | null {
  let quote: "'" | "\"" | null = null;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const previous = index > 0 ? line[index - 1] : "";

    if (quote) {
      if (char === quote && previous !== "\\") quote = null;
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (char === "#" && (index === 0 || /\s/.test(previous))) {
      return line.slice(index).trimEnd();
    }
  }

  return null;
}

function findYamlScalarQuote(line: string): "'" | "\"" | null {
  const match = /^[^:]+:\s*(["'])/.exec(line);
  if (!match) return null;

  return match[1] === "'" ? "'" : "\"";
}

function isYamlFlowSequence(line: string): boolean {
  return /^[^:]+:\s*\[/.test(line);
}

function shouldSerializeArrayAsFlowSequence(key: string, field?: UserDefinedField): boolean {
  return key === "aliases" || key === "tags" || key === "chronicle" || key === "date" || Boolean(field);
}

function isSingleValueField(field?: UserDefinedField): boolean {
  return Boolean(field && field.type !== "multi-select");
}

function firstArrayValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function findTopLevelYamlFieldEntries(lines: string[]): YamlFieldEntry[] {
  const entries: YamlFieldEntry[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = topLevelYamlFieldPattern.exec(lines[index]);
    if (!match) continue;

    let end = index + 1;
    while (end < lines.length && /^[ \t]/.test(lines[end])) end += 1;

    entries.push({ end, key: match[1].trim(), start: index });
  }

  return entries;
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
  private static clipboard:
    | { type: "row"; cells: string[] }
    | { type: "column"; cells: string[] }
    | null = null;

  constructor(private readonly block: TableBlock) {
    super();
  }

  eq(other: TableWidget): boolean {
    return (
      this.block.from === other.block.from &&
      this.block.to === other.block.to &&
      this.block.rows.map((row) => row.join("\u0000")).join("\u0001") ===
        other.block.rows.map((row) => row.join("\u0000")).join("\u0001")
    );
  }

  private findView(element: HTMLElement): EditorView | null {
    const editor = element.closest(".cm-editor");
    return editor instanceof HTMLElement ? EditorView.findFromDOM(editor) : EditorView.findFromDOM(element);
  }

  private focusCell(wrapper: HTMLElement, rowIndex: number, colIndex: number): void {
    const searchRoot = wrapper.closest(".cm-editor") ?? document;
    requestAnimationFrame(() => {
      const input = searchRoot.querySelector(
        `.cm-live-table-cell-input[data-row="${rowIndex}"][data-col="${colIndex}"]`
      );
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    });
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-live-table";
    const table = document.createElement("table");
    const colCount = Math.max(...this.block.rows.map((row) => row.length), 1);
    const rowCount = this.block.rows.length;
    let activeRow = Math.min(1, rowCount - 1);
    let activeCol = 0;

    const positionControls = () => {
      const colStart = (activeCol / colCount) * 100;
      const colCenter = ((activeCol + 0.5) / colCount) * 100;
      const colAfter = ((activeCol + 1) / colCount) * 100;
      const rowStart = (activeRow / rowCount) * 100;
      const rowCenter = ((activeRow + 0.5) / rowCount) * 100;
      const rowAfter = ((activeRow + 1) / rowCount) * 100;
      wrapper.style.setProperty("--table-active-col-start", `${colStart}%`);
      wrapper.style.setProperty("--table-active-col-center", `${colCenter}%`);
      wrapper.style.setProperty("--table-active-col-after", `${colAfter}%`);
      wrapper.style.setProperty("--table-active-col-width", `${100 / colCount}%`);
      wrapper.style.setProperty("--table-active-row-start", `${rowStart}%`);
      wrapper.style.setProperty("--table-active-row-center", `${rowCenter}%`);
      wrapper.style.setProperty("--table-active-row-after", `${rowAfter}%`);
      wrapper.style.setProperty("--table-active-row-height", `${100 / rowCount}%`);
    };

    const markActive = (axis: "row" | "column" | "cell", rowIndex: number, colIndex: number) => {
      activeRow = rowIndex;
      activeCol = colIndex;
      positionControls();
      wrapper.querySelectorAll(".cm-live-table-active").forEach((element) => {
        element.classList.remove("cm-live-table-active");
      });
      const selector = axis === "column"
        ? `[data-column="${colIndex}"]`
        : axis === "row"
          ? `[data-row="${rowIndex}"]`
          : `[data-row="${rowIndex}"][data-column="${colIndex}"]`;
      wrapper.querySelectorAll(selector).forEach((element) => {
        element.classList.add("cm-live-table-active");
      });
      wrapper.dataset.activeAxis = axis;
      wrapper.dataset.activeRow = String(rowIndex);
      wrapper.dataset.activeCol = String(colIndex);
    };

    const clearAffordance = () => {
      delete wrapper.dataset.canAddColumnBefore;
      delete wrapper.dataset.canAddColumnAfter;
      delete wrapper.dataset.canAddRowBefore;
      delete wrapper.dataset.canAddRowAfter;
      delete wrapper.dataset.canGrabColumn;
      delete wrapper.dataset.canGrabRow;
    };

    const setAddAffordance = (rowIndex: number, colIndex: number) => {
      activeRow = rowIndex;
      activeCol = colIndex;
      positionControls();
      clearAffordance();

      if (rowIndex === 0) wrapper.dataset.canAddColumnAfter = "true";
      if (rowIndex === rowCount - 1) wrapper.dataset.canAddColumnBefore = "true";
      if (colIndex === 0) wrapper.dataset.canAddRowBefore = "true";
      if (colIndex === colCount - 1) wrapper.dataset.canAddRowAfter = "true";
      if (rowIndex === 0) wrapper.dataset.canGrabColumn = "true";
      if (colIndex === 0) wrapper.dataset.canGrabRow = "true";
    };

    const clearActive = () => {
      wrapper.querySelectorAll(".cm-live-table-active").forEach((element) => {
        element.classList.remove("cm-live-table-active");
      });
      delete wrapper.dataset.activeAxis;
      delete wrapper.dataset.activeRow;
      delete wrapper.dataset.activeCol;
      clearAffordance();
    };

    const clearIfFocusOutside = (relatedTarget: EventTarget | null = null) => {
      const relatedNode = relatedTarget instanceof Node ? relatedTarget : null;

      if (relatedNode && wrapper.contains(relatedNode)) return;
      if (relatedNode && !wrapper.contains(relatedNode)) {
        clearActive();
        return;
      }

      requestAnimationFrame(() => {
        const activeElement = document.activeElement;
        if (activeElement && activeElement !== document.body && wrapper.contains(activeElement)) return;
        clearActive();
      });
    };

    const moveDraggedSelection = (targetRow: number, targetCol: number) => {
      const axis = wrapper.dataset.dragAxis;
      const sourceRow = Number(wrapper.dataset.dragSourceRow ?? activeRow);
      const sourceCol = Number(wrapper.dataset.dragSourceCol ?? activeCol);
      const view = this.findView(wrapper);
      if (!view || !axis) return;

      if (axis === "column" && targetCol !== sourceCol) {
        this.update(view, this.moveColTo(sourceCol, targetCol));
        this.focusCell(wrapper, Math.min(sourceRow, this.block.rows.length - 1), targetCol);
      } else if (axis === "row" && targetRow !== sourceRow && sourceRow > 0 && targetRow > 0) {
        this.update(view, this.moveRowTo(sourceRow, targetRow));
        this.focusCell(wrapper, targetRow, sourceCol);
      }
    };

    const setDropTarget = (targetRow: number, targetCol: number) => {
      const axis = wrapper.dataset.dragAxis;
      if (!axis) return;
      wrapper.dataset.dragTargetRow = String(targetRow);
      wrapper.dataset.dragTargetCol = String(targetCol);
      wrapper.style.setProperty("--table-drop-col", `${(targetCol / colCount) * 100}%`);
      wrapper.style.setProperty("--table-drop-row", `${(targetRow / rowCount) * 100}%`);
    };

    const cellFromPoint = (clientX: number, clientY: number): HTMLElement | null => {
      const element = typeof document.elementFromPoint === "function"
        ? document.elementFromPoint(clientX, clientY)
        : null;
      const cell = element instanceof HTMLElement ? element.closest("[data-row][data-column]") : null;
      return cell instanceof HTMLElement && wrapper.contains(cell) ? cell : null;
    };

    const targetFromCell = (cell: HTMLElement): { row: number; col: number } => ({
      row: Number(cell.dataset.row ?? 0),
      col: Number(cell.dataset.column ?? 0)
    });

    const targetFromPoint = (clientX: number, clientY: number): { row: number; col: number } | null => {
      const cell = cellFromPoint(clientX, clientY);
      if (cell) return targetFromCell(cell);

      const rect = table.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const col = Math.max(0, Math.min(colCount - 1, Math.floor(((clientX - rect.left) / rect.width) * colCount)));
      const row = Math.max(1, Math.min(rowCount - 1, Math.floor(((clientY - rect.top) / rect.height) * rowCount)));
      return { row, col };
    };

    const targetFromEvent = (event: MouseEvent | PointerEvent): { row: number; col: number } | null => {
      const cell = event.target instanceof HTMLElement ? event.target.closest("[data-row][data-column]") : null;
      if (cell instanceof HTMLElement && wrapper.contains(cell)) return targetFromCell(cell);
      return targetFromPoint(event.clientX, event.clientY);
    };

    const beginCoordinateDrag = (
      axis: "column" | "row",
      event: MouseEvent | PointerEvent
    ) => {
      if (wrapper.dataset.dragAxis) return;
      event.preventDefault();
      event.stopPropagation();
      const sourceRow = activeRow;
      const sourceCol = activeCol;
      wrapper.dataset.dragAxis = axis;
      wrapper.dataset.dragSourceRow = String(sourceRow);
      wrapper.dataset.dragSourceCol = String(sourceCol);
      setDropTarget(sourceRow, sourceCol);
      const firstTarget = targetFromPoint(event.clientX, event.clientY);
      if (firstTarget) setDropTarget(firstTarget.row, firstTarget.col);

      const move = (moveEvent: MouseEvent | PointerEvent) => {
        moveEvent.preventDefault();
        const target = targetFromEvent(moveEvent);
        if (target) {
          setDropTarget(target.row, target.col);
        }
      };
      const up = (upEvent: MouseEvent | PointerEvent) => {
        upEvent.preventDefault();
        const target = targetFromEvent(upEvent);
        if (target) {
          moveDraggedSelection(target.row, target.col);
        }
        delete wrapper.dataset.dragAxis;
        delete wrapper.dataset.dragSourceRow;
        delete wrapper.dataset.dragSourceCol;
        delete wrapper.dataset.dragTargetRow;
        delete wrapper.dataset.dragTargetCol;
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };

      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };
    positionControls();

    this.block.rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      Array.from({ length: colCount }, (_, colIndex) => row[colIndex] ?? "").forEach((cell, colIndex) => {
        const td = document.createElement(rowIndex === 0 ? "th" : "td");
        td.dataset.row = String(rowIndex);
        td.dataset.column = String(colIndex);
        td.addEventListener("dragover", (event) => {
          if (wrapper.dataset.dragAxis) event.preventDefault();
        });
        td.addEventListener("drop", (event) => {
          event.preventDefault();
          event.stopPropagation();
          moveDraggedSelection(rowIndex, colIndex);
        });
        const input = document.createElement("input");
        input.className = "cm-live-table-cell-input";
        input.dataset.row = String(rowIndex);
        input.dataset.col = String(colIndex);
        input.value = cell;
        const updateCell = () => {
          const view = this.findView(input);
          if (view) this.updateCell(view, rowIndex, colIndex, input.value);
        };
        input.addEventListener("focus", () => markActive("cell", rowIndex, colIndex));
        input.addEventListener("mouseenter", () => {
          activeRow = rowIndex;
          activeCol = colIndex;
          positionControls();
          setAddAffordance(rowIndex, colIndex);
        });
        td.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          markActive("cell", rowIndex, colIndex);
          this.showMenu(wrapper, event, rowIndex, colIndex);
        });
        input.addEventListener("blur", updateCell);
        input.addEventListener("blur", (event) => clearIfFocusOutside((event as FocusEvent).relatedTarget));
        input.addEventListener("change", updateCell);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const view = this.findView(input);
            if (!view) return;
            const nextRow = rowIndex + 1;
            const rows = this.withCellValue(rowIndex, colIndex, input.value);
            if (nextRow >= rows.length) {
              rows.push(Array.from({ length: colCount }, () => ""));
            }
            this.update(view, rows);
            this.focusCell(wrapper, nextRow, colIndex);
          } else if (event.key === "Tab") {
            event.preventDefault();
            const view = this.findView(input);
            if (!view) return;
            const rows = this.withCellValue(rowIndex, colIndex, input.value);
            const direction = event.shiftKey ? -1 : 1;
            let nextRow = rowIndex;
            let nextCol = colIndex + direction;
            if (nextCol >= colCount) {
              nextCol = 0;
              nextRow += 1;
            } else if (nextCol < 0) {
              nextRow = Math.max(0, nextRow - 1);
              nextCol = colCount - 1;
            }
            if (nextRow >= rows.length) {
              rows.push(Array.from({ length: colCount }, () => ""));
            }
            this.update(view, rows);
            this.focusCell(wrapper, nextRow, nextCol);
          }
        });
        td.append(input);
        tr.append(td);
      });

      table.append(tr);
    });

    wrapper.append(table);
    const columnHandle = document.createElement("button");
    columnHandle.className = "cm-live-table-handle cm-live-table-handle--column";
    columnHandle.type = "button";
    columnHandle.title = "列を選択";
    columnHandle.textContent = "•••";
    columnHandle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markActive("column", activeRow, activeCol);
    });
    columnHandle.addEventListener("mouseenter", () => {
      setAddAffordance(0, activeCol);
      wrapper.dataset.canGrabColumn = "true";
    });
    columnHandle.addEventListener("pointerdown", (event) => {
      markActive("column", activeRow, activeCol);
      beginCoordinateDrag("column", event);
    });
    columnHandle.addEventListener("mousedown", (event) => {
      if (typeof window.PointerEvent === "function") return;
      markActive("column", activeRow, activeCol);
      beginCoordinateDrag("column", event);
    });
    columnHandle.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markActive("column", activeRow, activeCol);
      this.showMenu(wrapper, event, activeRow, activeCol);
    });
    wrapper.append(columnHandle);
    const rowHandle = document.createElement("button");
    rowHandle.className = "cm-live-table-handle cm-live-table-handle--row";
    rowHandle.type = "button";
    rowHandle.title = "行を選択";
    rowHandle.textContent = "•••";
    rowHandle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markActive("row", activeRow, activeCol);
    });
    rowHandle.addEventListener("mouseenter", () => {
      setAddAffordance(activeRow, 0);
      wrapper.dataset.canGrabRow = "true";
    });
    rowHandle.addEventListener("pointerdown", (event) => {
      markActive("row", activeRow, activeCol);
      beginCoordinateDrag("row", event);
    });
    rowHandle.addEventListener("mousedown", (event) => {
      if (typeof window.PointerEvent === "function") return;
      markActive("row", activeRow, activeCol);
      beginCoordinateDrag("row", event);
    });
    rowHandle.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markActive("row", activeRow, activeCol);
      this.showMenu(wrapper, event, activeRow, activeCol);
    });
    wrapper.append(rowHandle);
    wrapper.append(this.edgeAddButton("column-before", () => activeCol, () => activeRow));
    wrapper.append(this.edgeAddButton("column-after", () => activeCol + 1, () => activeRow));
    wrapper.append(this.edgeAddButton("row-before", () => Math.max(1, activeRow), () => activeCol));
    wrapper.append(this.edgeAddButton("row-after", () => activeRow + 1, () => activeCol));
    wrapper.addEventListener("focusout", (event) => {
      clearIfFocusOutside((event as FocusEvent).relatedTarget);
    });
    wrapper.addEventListener("mouseleave", () => {
      if (!wrapper.dataset.dragAxis) clearAffordance();
    });
    wrapper.addEventListener("dragover", (event) => {
      if (wrapper.dataset.dragAxis) event.preventDefault();
    });
    wrapper.addEventListener("drop", (event) => {
      if (!wrapper.dataset.dragAxis) return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.target instanceof HTMLElement
        ? event.target.closest("[data-row][data-column]")
        : null;
      if (target instanceof HTMLElement) {
        moveDraggedSelection(Number(target.dataset.row ?? 0), Number(target.dataset.column ?? 0));
      }
    });

    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
  }

  private showMenu(wrapper: HTMLElement, event: MouseEvent, rowIndex: number, colIndex: number): void {
    wrapper.querySelector(".cm-live-table-menu")?.remove();
    const view = this.findView(wrapper);
    if (!view) return;

    const menu = document.createElement("div");
    menu.className = "cm-live-table-menu";
    const rect = wrapper.getBoundingClientRect();
    menu.style.left = `${event.clientX - rect.left}px`;
    menu.style.top = `${event.clientY - rect.top}px`;

    const addItem = (
      label: string,
      action: () => void,
      disabled = false
    ) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = disabled;
      button.addEventListener("click", (clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        if (!disabled) {
          action();
          menu.remove();
        }
      });
      menu.append(button);
    };

    const separator = () => {
      const hr = document.createElement("div");
      hr.className = "cm-live-table-menu-separator";
      menu.append(hr);
    };

    const colCount = Math.max(...this.block.rows.map((row) => row.length), 1);
    addItem("行を上に追加", () => {
      this.update(view, this.insertRow(Math.max(1, rowIndex)));
      this.focusCell(wrapper, Math.max(1, rowIndex), colIndex);
    }, rowIndex === 0);
    addItem("行を下に追加", () => {
      this.update(view, this.insertRow(rowIndex + 1));
      this.focusCell(wrapper, rowIndex + 1, colIndex);
    });
    addItem("行を削除", () => {
      this.update(view, this.deleteRow(rowIndex));
      this.focusCell(wrapper, Math.max(1, Math.min(rowIndex, this.block.rows.length - 2)), colIndex);
    }, rowIndex === 0 || this.block.rows.length <= 2);
    addItem("行を上へ移動", () => {
      this.update(view, this.moveRow(rowIndex, -1));
      this.focusCell(wrapper, rowIndex - 1, colIndex);
    }, rowIndex <= 1);
    addItem("行を下へ移動", () => {
      this.update(view, this.moveRow(rowIndex, 1));
      this.focusCell(wrapper, rowIndex + 1, colIndex);
    }, rowIndex === 0 || rowIndex >= this.block.rows.length - 1);
    addItem("行をコピー", () => {
      TableWidget.clipboard = { type: "row", cells: [...this.block.rows[rowIndex]] };
    });
    addItem("コピーした行を下に貼り付け", () => {
      if (TableWidget.clipboard?.type !== "row") return;
      const rows = this.block.rows.map((row) => [...row]);
      rows.splice(rowIndex + 1, 0, Array.from({ length: colCount }, (_, i) => TableWidget.clipboard?.cells[i] ?? ""));
      this.update(view, rows);
      this.focusCell(wrapper, rowIndex + 1, colIndex);
    }, TableWidget.clipboard?.type !== "row");

    separator();

    addItem("列を左に追加", () => {
      this.update(view, this.insertCol(colIndex));
      this.focusCell(wrapper, rowIndex, colIndex);
    });
    addItem("列を右に追加", () => {
      this.update(view, this.insertCol(colIndex + 1));
      this.focusCell(wrapper, rowIndex, colIndex + 1);
    });
    addItem("列を削除", () => {
      this.update(view, this.deleteCol(colIndex));
      this.focusCell(wrapper, rowIndex, Math.max(0, colIndex - 1));
    }, colCount <= 1);
    addItem("列を左へ移動", () => {
      this.update(view, this.moveCol(colIndex, -1));
      this.focusCell(wrapper, rowIndex, colIndex - 1);
    }, colIndex <= 0);
    addItem("列を右へ移動", () => {
      this.update(view, this.moveCol(colIndex, 1));
      this.focusCell(wrapper, rowIndex, colIndex + 1);
    }, colIndex >= colCount - 1);
    addItem("列を昇順に並べ替え", () => {
      this.update(view, this.sortByCol(colIndex, "asc"));
      this.focusCell(wrapper, Math.min(1, this.block.rows.length - 1), colIndex);
    });
    addItem("列を降順に並べ替え", () => {
      this.update(view, this.sortByCol(colIndex, "desc"));
      this.focusCell(wrapper, Math.min(1, this.block.rows.length - 1), colIndex);
    });
    addItem("列をコピー", () => {
      TableWidget.clipboard = { type: "column", cells: this.block.rows.map((row) => row[colIndex] ?? "") };
    });
    addItem("コピーした列を右に貼り付け", () => {
      if (TableWidget.clipboard?.type !== "column") return;
      const rows = this.block.rows.map((row, rowIndex) => {
        const next = [...row];
        next.splice(colIndex + 1, 0, TableWidget.clipboard?.cells[rowIndex] ?? "");
        return next;
      });
      this.update(view, rows);
      this.focusCell(wrapper, rowIndex, colIndex + 1);
    }, TableWidget.clipboard?.type !== "column");

    wrapper.append(menu);
    const dismiss = (dismissEvent: MouseEvent) => {
      if (!menu.contains(dismissEvent.target as Node)) {
        menu.remove();
        document.removeEventListener("mousedown", dismiss);
      }
    };
    requestAnimationFrame(() => document.addEventListener("mousedown", dismiss));
  }

  private edgeAddButton(
    axis: "column-before" | "column-after" | "row-before" | "row-after",
    getInsertIndex: () => number,
    getFocusIndex: () => number
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cm-live-table-add cm-live-table-add--${axis}`;
    button.textContent = "+";
    button.title = axis.startsWith("column")
      ? axis.endsWith("before") ? "Add column before" : "Add column after"
      : axis.endsWith("before") ? "Add row before" : "Add row after";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const view = this.findView(button);
      if (!view) return;
      const index = getInsertIndex();
      const isColumn = axis.startsWith("column");
      const rows = isColumn ? this.insertCol(index) : this.insertRow(index);
      this.update(view, rows);
      this.focusCell(
        button,
        isColumn ? Math.min(getFocusIndex(), this.block.rows.length - 1) : index,
        isColumn ? index : getFocusIndex()
      );
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
  }

  private withCellValue(rowIndex: number, colIndex: number, value: string): string[][] {
    return this.block.rows.map((row, currentRowIndex) => {
      const next = [...row];
      if (currentRowIndex === rowIndex) next[colIndex] = value;
      return next;
    });
  }

  private updateCell(view: EditorView, rowIndex: number, colIndex: number, value: string): void {
    this.update(view, this.withCellValue(rowIndex, colIndex, value));
  }

  private insertRow(index: number): string[][] {
    const colCount = Math.max(...this.block.rows.map((row) => row.length), 1);
    const rows = this.block.rows.map((row) => [...row]);
    rows.splice(index, 0, Array.from({ length: colCount }, () => ""));
    return rows;
  }

  private deleteRow(index: number): string[][] {
    return this.block.rows.filter((_, rowIndex) => rowIndex !== index);
  }

  private insertCol(index: number): string[][] {
    return this.block.rows.map((row) => {
      const next = [...row];
      next.splice(index, 0, "");
      return next;
    });
  }

  private deleteCol(index: number): string[][] {
    return this.block.rows.map((row) => row.filter((_, colIndex) => colIndex !== index));
  }

  private moveRow(index: number, direction: -1 | 1): string[][] {
    const rows = this.block.rows.map((row) => [...row]);
    const target = index + direction;
    if (index <= 0 || target <= 0 || target >= rows.length) return rows;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    return rows;
  }

  private moveRowTo(from: number, to: number): string[][] {
    const rows = this.block.rows.map((row) => [...row]);
    if (from <= 0 || to <= 0 || from >= rows.length || to >= rows.length) return rows;
    const [row] = rows.splice(from, 1);
    rows.splice(to, 0, row);
    return rows;
  }

  private moveCol(index: number, direction: -1 | 1): string[][] {
    return this.block.rows.map((row) => {
      const next = [...row];
      const target = index + direction;
      if (target < 0 || target >= next.length) return next;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  private moveColTo(from: number, to: number): string[][] {
    return this.block.rows.map((row) => {
      const next = [...row];
      if (from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
      const [cell] = next.splice(from, 1);
      next.splice(to, 0, cell);
      return next;
    });
  }

  private sortByCol(index: number, direction: "asc" | "desc"): string[][] {
    const [header, ...body] = this.block.rows.map((row) => [...row]);
    body.sort((left, right) => {
      const result = (left[index] ?? "").localeCompare(right[index] ?? "", undefined, {
        numeric: true,
        sensitivity: "base"
      });
      return direction === "asc" ? result : -result;
    });
    return [header, ...body];
  }
}

class ListMarkerWidget extends WidgetType {
  constructor(
    private readonly label: string,
    private readonly className: string
  ) {
    super();
  }

  eq(other: ListMarkerWidget): boolean {
    return this.label === other.label && this.className === other.className;
  }

  toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.className = this.className;
    marker.textContent = this.label;
    return marker;
  }
}

class InlineFormatWidget extends WidgetType {
  constructor(
    private readonly tagName: "span" | "strong" | "em" | "code" | "a" | "u",
    private readonly text: string,
    private readonly className: string,
    private readonly onClick?: () => void
  ) {
    super();
  }

  eq(other: InlineFormatWidget): boolean {
    return this.tagName === other.tagName && this.text === other.text && this.className === other.className;
  }

  toDOM(): HTMLElement {
    const element = document.createElement(this.tagName);
    element.className = this.className;
    element.textContent = this.text;
    if (this.onClick) {
      let opened = false;
      const openLink = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (opened) return;
        opened = true;
        this.onClick?.();
        window.setTimeout(() => {
          opened = false;
        }, 0);
      };
      element.addEventListener("pointerdown", openLink);
      element.addEventListener("mousedown", openLink);
      element.addEventListener("click", openLink);
    }
    if (this.className === "cm-live-bold") {
      element.style.display = "inline-block";
      element.style.fontWeight = "900";
      element.style.paddingInline = "0.015em";
      element.style.textShadow = "0.025em 0 0 currentColor";
    }
    if (this.className === "cm-live-italic") {
      element.style.display = "inline-block";
      element.style.fontStyle = "italic";
      element.style.transform = "skewX(-14deg)";
      element.style.transformOrigin = "baseline";
    }
    return element;
  }

  ignoreEvent(event: Event): boolean {
    return Boolean(this.onClick && ["click", "mousedown", "pointerdown"].includes(event.type));
  }
}

class CheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked;
  }

  toDOM(): HTMLElement {
    const checkbox = document.createElement("input");
    checkbox.className = "cm-live-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.tabIndex = -1;
    return checkbox;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement("hr");
    hr.className = "cm-live-hr";
    return hr;
  }
}

class FrontmatterPropertiesWidget extends WidgetType {
  constructor(
    private readonly block: FrontmatterBlock,
    private readonly userDefinedFields: UserDefinedField[],
    private readonly candidates: Record<string, string[]>,
    private readonly lineNumber: number
  ) {
    super();
  }

  eq(other: FrontmatterPropertiesWidget): boolean {
    return this.block.from === other.block.from &&
      this.block.to === other.block.to &&
      JSON.stringify(this.block.data) === JSON.stringify(other.block.data) &&
      this.lineNumber === other.lineNumber;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("section");
    wrapper.className = "cm-frontmatter-properties";

    if (this.lineNumber !== this.block.startLine) {
      const row = this.rowForLine(view);
      if (row) {
        wrapper.append(row);
      } else {
        wrapper.classList.add("cm-frontmatter-properties--spacer");
      }
      return wrapper;
    }

    const header = document.createElement("button");
    header.className = "cm-frontmatter-header";
    header.type = "button";

    const icon = document.createElement("span");
    icon.className = "cm-frontmatter-toggle";
    icon.textContent = "⌄";
    const title = document.createElement("span");
    title.textContent = "プロパティ";
    const count = document.createElement("span");
    count.className = "cm-frontmatter-count";
    count.textContent = String(Object.keys(this.block.data).length);
    header.append(icon, title, count);

    header.addEventListener("click", () => {
      const collapsed = wrapper.dataset.collapsed === "true";
      wrapper.dataset.collapsed = collapsed ? "false" : "true";
    });

    wrapper.append(header);
    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }

  private renderRow(view: EditorView, key: string, value: unknown): HTMLElement {
    const row = document.createElement("div");
    row.className = "cm-frontmatter-row";

    const drag = document.createElement("span");
    drag.className = "cm-frontmatter-row-icon";
    drag.textContent = "☰";

    const label = document.createElement("span");
    label.className = "cm-frontmatter-key";
    label.textContent = key;

    const field = this.fieldFor(key);
    const input = key === "chronicle"
      ? this.chronicleInput(view, key, Array.isArray(value) ? value : [])
      : key === "date"
        ? this.dateRangeInput(view, key, Array.isArray(value) ? value : value === null || value === undefined ? [] : [value])
      : field?.type === "boolean"
        ? this.booleanInput(view, key, firstArrayValue(value), true)
        : isSingleValueField(field)
          ? this.scalarInput(view, key, firstArrayValue(value), field, true)
        : field?.type === "multi-select" || key === "aliases" || key === "tags" || Array.isArray(value)
          ? this.arrayInput(view, key, Array.isArray(value) ? value : value === null || value === undefined ? [] : [value], field)
          : this.isEditableScalar(value)
            ? this.scalarInput(view, key, value, field)
            : this.complexValueInput(view, key, value);
    const removeButton = document.createElement("button");
    removeButton.className = "cm-frontmatter-remove";
    removeButton.title = "プロパティを削除";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => this.updateField(view, key, undefined));

    row.append(drag, label, input, removeButton);
    return row;
  }

  private rowForLine(view: EditorView): HTMLElement | null {
    const yamlLineIndex = this.lineNumber - this.block.startLine - 1;
    if (yamlLineIndex < 0 || this.lineNumber >= this.block.endLine) return null;

    const lines = this.block.yamlText.replace(/\r\n/g, "\n").split("\n");
    if (lines.at(-1) === "") lines.pop();
    const entry = findTopLevelYamlFieldEntries(lines).find((item) => item.start === yamlLineIndex);
    if (!entry || !Object.prototype.hasOwnProperty.call(this.block.data, entry.key)) return null;

    return this.renderRow(view, entry.key, this.block.data[entry.key]);
  }

  private isEditableScalar(value: unknown): boolean {
    return value === null || value === undefined || typeof value !== "object" || value instanceof Date;
  }

  private scalarInput(view: EditorView, key: string, value: unknown, field?: UserDefinedField, writeAsArray = false): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-frontmatter-input-wrap";
    const input = document.createElement("input");
    input.className = "cm-frontmatter-input";
    input.type = this.inputTypeFor(field);
    input.value = this.scalarInputValue(value, field);
    const datalist = this.createDatalist(input, key, this.choicesFor(key, field));

    input.addEventListener("change", () => {
      const nextValue = this.parseScalarValue(input.value, field);
      this.updateField(view, key, writeAsArray && nextValue !== undefined ? [nextValue] : nextValue);
    });

    wrap.append(input);
    if (datalist) wrap.append(datalist);
    return wrap;
  }

  private inputTypeFor(field?: UserDefinedField): string {
    if (field?.type === "date") return "date";
    if (field?.type === "datetime") return "datetime-local";
    if (field?.type === "time") return "time";
    if (field?.type === "number") return "number";
    if (field?.type === "url") return "url";
    return "text";
  }

  private scalarInputValue(value: unknown, field?: UserDefinedField): string {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) {
      if (field?.type === "datetime") return value.toISOString().slice(0, 16);
      if (field?.type === "time") return value.toISOString().slice(11, 16);
      return value.toISOString().slice(0, 10);
    }
    return String(value);
  }

  private complexValueInput(view: EditorView, key: string, value: unknown): HTMLElement {
    const textarea = document.createElement("textarea");
    textarea.className = "cm-frontmatter-yaml-input";
    textarea.rows = 3;
    textarea.spellcheck = false;
    textarea.value = yaml.dump(value, { lineWidth: -1 }).trimEnd();

    textarea.addEventListener("change", () => {
      try {
        textarea.removeAttribute("aria-invalid");
        this.updateField(view, key, yaml.load(textarea.value));
      } catch {
        textarea.setAttribute("aria-invalid", "true");
      }
    });

    return textarea;
  }

  private booleanInput(view: EditorView, key: string, value: unknown, writeAsArray = false): HTMLElement {
    const label = document.createElement("label");
    label.className = "cm-frontmatter-boolean";
    const input = document.createElement("input");
    input.className = "cm-frontmatter-checkbox";
    input.checked = value === true || String(value).toLowerCase() === "true";
    input.type = "checkbox";
    const text = document.createElement("span");
    text.textContent = input.checked ? "true" : "false";

    input.addEventListener("change", () => {
      text.textContent = input.checked ? "true" : "false";
      this.updateField(view, key, writeAsArray ? [input.checked] : input.checked);
    });

    label.append(input, text);
    return label;
  }

  private chronicleInput(view: EditorView, key: string, value: unknown[]): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-frontmatter-input-wrap cm-frontmatter-chronicle";

    const startInput = document.createElement("input");
    startInput.className = "cm-frontmatter-input";
    startInput.type = "number";
    startInput.value = this.chronicleInputValue(value[0]);

    const endInput = document.createElement("input");
    endInput.className = "cm-frontmatter-input";
    endInput.placeholder = "end";
    endInput.type = "number";
    endInput.value = value.length > 1 ? this.chronicleInputValue(value[1]) : "";

    const commit = (): void => {
      const startYear = parseChronicleYearInput(startInput.value);
      const endYear = parseChronicleYearInput(endInput.value);

      if (startYear === null) {
        this.updateField(view, key, undefined);
        return;
      }

      if (endYear === null || endYear === startYear) {
        this.updateField(view, key, [startYear]);
        return;
      }

      this.updateField(view, key, startYear <= endYear ? [startYear, endYear] : [endYear, startYear]);
    };

    startInput.addEventListener("change", commit);
    endInput.addEventListener("change", commit);
    wrap.append(startInput, endInput);
    return wrap;
  }

  private chronicleInputValue(value: unknown): string {
    return typeof value === "number" && Number.isInteger(value) && value !== 0 ? String(value) : "";
  }

  private dateRangeInput(view: EditorView, key: string, value: unknown[]): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-frontmatter-input-wrap cm-frontmatter-date-range";

    const startInput = document.createElement("input");
    startInput.className = "cm-frontmatter-input";
    startInput.type = "date";
    startInput.value = this.dateInputValue(value[0]);

    const endInput = document.createElement("input");
    endInput.className = "cm-frontmatter-input";
    endInput.type = "date";
    endInput.value = value.length > 1 ? this.dateInputValue(value[1]) : "";

    const commit = (): void => {
      const startDate = parseDateInput(startInput.value);
      const endDate = parseDateInput(endInput.value);

      if (startDate === null) {
        this.updateField(view, key, undefined);
        return;
      }

      if (endDate === null || endDate === startDate) {
        this.updateField(view, key, [startDate]);
        return;
      }

      this.updateField(view, key, startDate <= endDate ? [startDate, endDate] : [endDate, startDate]);
    };

    startInput.addEventListener("change", commit);
    endInput.addEventListener("change", commit);
    wrap.append(startInput, endInput);
    return wrap;
  }

  private dateInputValue(value: unknown): string {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return typeof value === "string" && parseDateInput(value) !== null ? value : "";
  }

  private arrayInput(view: EditorView, key: string, value: unknown[], field?: UserDefinedField): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-frontmatter-pills";

    for (const [index, item] of value.entries()) {
      const pill = document.createElement("span");
      pill.className = "cm-frontmatter-pill";

      const itemInput = document.createElement("input");
      itemInput.className = "cm-frontmatter-pill-value";
      itemInput.value = String(item);
      itemInput.addEventListener("change", () => {
        const nextValue = itemInput.value.trim();
        const nextItems = value.map(String);
        if (!nextValue) {
          nextItems.splice(index, 1);
        } else {
          nextItems[index] = nextValue;
        }
        this.updateField(view, key, nextItems);
      });

      const removeButton = document.createElement("button");
      removeButton.className = "cm-frontmatter-pill-remove";
      removeButton.title = "値を削除";
      removeButton.type = "button";
      removeButton.textContent = "×";
      removeButton.addEventListener("click", () => {
        this.updateField(view, key, value.map(String).filter((_, itemIndex) => itemIndex !== index));
      });

      pill.append(itemInput, removeButton);
      wrap.append(pill);
    }

    const input = document.createElement("input");
    input.className = "cm-frontmatter-pill-input";
    input.placeholder = "+";
    const datalist = this.createDatalist(input, key, this.choicesFor(key, field));
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const nextValue = input.value.trim();
      if (!nextValue) return;
      this.updateField(view, key, [...value.map(String), nextValue]);
    });
    wrap.append(input);
    if (datalist) wrap.append(datalist);

    return wrap;
  }

  private updateField(view: EditorView, key: string, value: unknown): void {
    const nextData = { ...this.block.data };

    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
      delete nextData[key];
    } else {
      nextData[key] = value;
    }

    this.writeData(view, nextData);
  }

  private writeData(view: EditorView, nextData: Record<string, unknown>): void {
    const nextYaml = this.serializeDataPreservingYaml(nextData).trimEnd();
    const nextBlock = Object.keys(nextData).length > 0 ? `---\n${nextYaml}\n---` : "";
    view.dispatch({
      changes: {
        from: this.block.from,
        insert: nextBlock,
        to: this.block.to
      }
    });
  }

  private serializeData(data: Record<string, unknown>): string {
    return Object.entries(data)
      .map(([key, value]) => {
        const field = this.fieldFor(key);
        if (value === "") return `${key}:`;
        if (Array.isArray(value) && shouldSerializeArrayAsFlowSequence(key, field)) {
          return `${key}: [${value.map((item) => this.serializeFlowScalar(key, item)).join(", ")}]`;
        }
        if (field?.type === "date" && typeof value === "string") return `${key}: ${value}`;
        return yaml.dump({ [key]: value }, { lineWidth: -1 }).trimEnd();
      })
      .join("\n");
  }

  private serializeEntryPreservingInlineComment(entry: YamlFieldEntry, lines: string[], value: unknown): string {
    const serialized = this.serializeEntryPreservingQuote(entry, lines, value);
    const comment = entry.end === entry.start + 1 ? findYamlInlineComment(lines[entry.start]) : null;

    if (!comment || serialized.includes("\n")) return serialized;

    return `${serialized} ${comment}`;
  }

  private serializeEntryPreservingQuote(entry: YamlFieldEntry, lines: string[], value: unknown): string {
    const field = this.fieldFor(entry.key);

    if (
      Array.isArray(value) &&
      (
        shouldSerializeArrayAsFlowSequence(entry.key, field) ||
        (entry.end === entry.start + 1 && isYamlFlowSequence(lines[entry.start]))
      )
    ) {
      return `${entry.key}: [${value.map((item) => this.serializeFlowScalar(entry.key, item)).join(", ")}]`;
    }

    if (entry.end !== entry.start + 1 || typeof value !== "string" || value.includes("\n")) {
      return this.serializeData({ [entry.key]: value });
    }

    const quote = findYamlScalarQuote(lines[entry.start]);
    if (!quote) return this.serializeData({ [entry.key]: value });

    if (quote === "'") {
      return `${entry.key}: '${value.replaceAll("'", "''")}'`;
    }

    return `${entry.key}: ${JSON.stringify(value)}`;
  }

  private serializeFlowScalar(key: string, value: unknown): string {
    if (key === "date" && typeof value === "string" && parseDateInput(value) !== null) return value;
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value === null) return "null";
    return JSON.stringify(String(value));
  }

  private serializeDataPreservingYaml(data: Record<string, unknown>): string {
    const keys = Object.keys(data);
    if (keys.length === 0) return "";

    const lines = this.block.yamlText.replace(/\r\n/g, "\n").split("\n");
    if (lines.at(-1) === "") lines.pop();

    const entries = findTopLevelYamlFieldEntries(lines);
    if (entries.length === 0) {
      const preservedPrefix = lines.join("\n").trimEnd();
      const serialized = this.serializeData(data);
      return preservedPrefix ? `${preservedPrefix}\n${serialized}` : serialized;
    }

    const entryByStart = new Map(entries.map((entry) => [entry.start, entry]));
    const writtenKeys = new Set<string>();
    const output: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const entry = entryByStart.get(index);
      if (!entry) {
        output.push(lines[index]);
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(data, entry.key)) {
        output.push(this.serializeEntryPreservingInlineComment(entry, lines, data[entry.key]));
        writtenKeys.add(entry.key);
      }

      index = entry.end - 1;
    }

    for (const key of keys) {
      if (!writtenKeys.has(key)) output.push(this.serializeData({ [key]: data[key] }));
    }

    return output.join("\n");
  }

  private fieldFor(key: string): UserDefinedField | undefined {
    if (key === "aliases" || key === "tags") return { name: key, type: "multi-select" };
    if (key === "date") return { name: key, type: "date" };
    return this.userDefinedFields.find((field) => field.name === key);
  }

  private choicesFor(key: string, field?: UserDefinedField): string[] {
    return Array.from(new Set([...(field?.choices ?? []), ...(this.candidates[key] ?? [])])).sort((a, b) => a.localeCompare(b));
  }

  private createDatalist(input: HTMLInputElement, key: string, values: string[]): HTMLDataListElement | null {
    if (values.length === 0) return null;

    const datalist = document.createElement("datalist");
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "-");
    datalist.id = `cm-frontmatter-${safeKey}-${Math.random().toString(36).slice(2)}`;

    for (const value of values) {
      const option = document.createElement("option");
      option.value = value;
      datalist.append(option);
    }

    input.setAttribute("list", datalist.id);
    return datalist;
  }

  private parseScalarValue(value: string, field?: UserDefinedField): unknown {
    if (value === "") return undefined;
    if (field?.type === "number") {
      const numericValue = Number(value);
      return Number.isNaN(numericValue) ? value : numericValue;
    }
    return value;
  }
}

function overlaps(from: number, to: number, ranges: Array<{ from: number; to: number }>): boolean {
  return ranges.some((range) => from < range.to && to > range.from);
}

function parseChronicleYearInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const year = Number(trimmed);
  return Number.isInteger(year) && year !== 0 ? year : null;
}

function parseDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed ? null : trimmed;
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

function findFrontmatterLineRange(doc: Text): { end: number; start: number } | null {
  if (doc.lines < 2 || doc.line(1).text.trim() !== "---") return null;

  for (let lineNumber = 2; lineNumber <= doc.lines; lineNumber += 1) {
    if (doc.line(lineNumber).text.trim() === "---") {
      return { end: lineNumber, start: 1 };
    }
  }

  return null;
}

function findFrontmatterBlock(state: EditorState): FrontmatterBlock | null {
  const range = findFrontmatterLineRange(state.doc);
  if (!range) return null;

  const openLine = state.doc.line(range.start);
  const closeLine = state.doc.line(range.end);
  const yamlText = state.doc.sliceString(openLine.to + 1, closeLine.from);

  try {
    const parsed = yaml.load(yamlText);

    if (parsed === null || parsed === undefined) {
      return {
        bodyFrom: closeLine.to + 1,
        data: {},
        endLine: range.end,
        from: openLine.from,
        startLine: range.start,
        to: closeLine.to,
        yamlText
      };
    }
    if (typeof parsed !== "object" || Array.isArray(parsed)) return null;

    return {
      bodyFrom: closeLine.to + 1,
      data: parsed as Record<string, unknown>,
      endLine: range.end,
      from: openLine.from,
      startLine: range.start,
      to: closeLine.to,
      yamlText
    };
  } catch {
    return null;
  }
}

export function buildFrontmatterPropertiesDecorations(
  state: EditorState,
  userDefinedFields: UserDefinedField[] = [],
  candidates: Record<string, string[]> = {}
): DecorationSet {
  const block = findFrontmatterBlock(state);
  if (!block) return Decoration.none;

  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  for (let lineNumber = block.startLine; lineNumber <= block.endLine; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const widget = new FrontmatterPropertiesWidget(block, userDefinedFields, candidates, lineNumber);
    ranges.push({
      from: line.from,
      to: line.to,
      deco: line.from < line.to
        ? Decoration.replace({ widget })
        : Decoration.widget({ widget })
    });
  }

  return Decoration.set(ranges.map((range) => range.deco.range(range.from, range.to)), true);
}

export function buildLivePreviewDecorations(
  view: EditorView,
  onOpenClickableLink?: (link: ClickableLinkAtPosition) => void
): DecorationSet {
  const { state } = view;
  const doc = state.doc;
  const editorHasFocus = typeof view.hasFocus === "boolean" ? view.hasFocus : true;

  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const tableBlocks = findTableBlocks(state);
  const frontmatterLineRange = findFrontmatterLineRange(doc);
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
    if (from < to) {
      const attributes = cls === "cm-live-bold"
        ? { style: "display: inline-block; font-weight: 900; padding-inline: 0.015em; text-shadow: 0.025em 0 0 currentColor;" }
        : cls === "cm-live-italic"
          ? { style: "display: inline-block; font-style: italic; transform: skewX(-14deg); transform-origin: baseline;" }
          : undefined;
      ranges.push({ from, to, deco: Decoration.mark({ attributes, class: cls }) });
    }
  }

  function addWidget(from: number, to: number, widget: WidgetType) {
    if (from < to && !shouldRevealSource(from, to)) {
      ranges.push({ from, to, deco: Decoration.replace({ widget }) });
    }
  }

  function addInlineFormat(lineFrom: number, match: InlineMatch, text: string) {
    if (!selectionTouches(match.from, match.to)) {
      const tagName = match.className === "cm-live-bold"
        ? "strong"
        : match.className === "cm-live-italic"
          ? "em"
          : match.className === "cm-live-code"
            ? "code"
            : match.className === "cm-live-underline"
              ? "u"
              : "span";
      const link = match.className === "cm-live-link"
        ? findClickableLinkAtPosition(state.doc, match.from)
        : null;
      const handleClick = link
        ? () => onOpenClickableLink?.(link)
        : undefined;

      addWidget(
        match.from,
        match.to,
        new InlineFormatWidget(
          tagName,
          text.slice(match.contentFrom - lineFrom, match.contentTo - lineFrom),
          match.className,
          handleClick
        )
      );
      return;
    }

    addSourceReveal(match.from, match.to);
    addMark(match.contentFrom, match.contentTo, match.className);
    for (const hideRange of match.hideRanges) addReplace(hideRange.from, hideRange.to);
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

    matches.push(...collectRegexMatches(text, /<u>([^<\n]+)<\/u>/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: from + 3,
        contentTo: to - 4,
        className: "cm-live-underline",
        hideRanges: [{ from, to: from + 3 }, { from: to - 4, to }]
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
      addInlineFormat(lineFrom, match, text);
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

      if (
        frontmatterLineRange &&
        lineNumber >= frontmatterLineRange.start &&
        lineNumber <= frontmatterLineRange.end
      ) {
        addMark(line.from, line.to, "cm-live-frontmatter");
        lineNumber += 1;
        continue;
      }

      if (/^\s*```/.test(text)) {
        addSourceReveal(line.from, line.to);
        addReplace(line.from, line.to);
        inFencedCode = !inFencedCode;
        lineNumber += 1;
        continue;
      }

      if (tableBlock) {
        lineNumber += 1;
        continue;
      }

      if (inFencedCode) {
        addMark(line.from, line.to, "cm-live-code-block");
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
      } else if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(text)) {
        addSourceReveal(line.from, line.to);
        addWidget(line.from, line.to, new HorizontalRuleWidget());
      } else if (/^\s*>\s?/.test(text)) {
        const match = /^(\s*>\s?)(.*)$/.exec(text);
        if (match) {
          const contentFrom = line.from + match[1].length;
          addSourceReveal(line.from, line.to);
          addReplace(line.from, contentFrom);
          addMark(contentFrom, line.to, "cm-live-blockquote");
          addInlineDecorations(contentFrom, match[2]);
        }
      } else if (/^\s*[-*+]\s+\[[ xX]\]\s+/.test(text)) {
        const match = /^(\s*[-*+]\s+\[([ xX])\]\s+)(.*)$/.exec(text);
        if (match) {
          const contentFrom = line.from + match[1].length;
          addSourceReveal(line.from, line.to);
          addWidget(line.from, contentFrom, new CheckboxWidget(/[xX]/.test(match[2])));
          addInlineDecorations(contentFrom, match[3]);
        }
      } else if (/^\s*[-*+]\s+/.test(text)) {
        const match = /^(\s*[-*+]\s+)(.*)$/.exec(text);
        if (match) {
          const contentFrom = line.from + match[1].length;
          addSourceReveal(line.from, line.to);
          addWidget(line.from, contentFrom, new ListMarkerWidget("•", "cm-live-list-marker"));
          addInlineDecorations(contentFrom, match[2]);
        }
      } else if (/^\s*\d+[.)]\s+/.test(text)) {
        const match = /^(\s*)(\d+)([.)]\s+)(.*)$/.exec(text);
        if (match) {
          const markerTo = line.from + match[0].length - match[4].length;
          addSourceReveal(line.from, line.to);
          addWidget(line.from, markerTo, new ListMarkerWidget(`${match[2]}.`, "cm-live-ordered-marker"));
          addInlineDecorations(markerTo, match[4]);
        }
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

  for (const block of findTableBlocks(state)) {
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

function createFrontmatterPropertiesField(
  userDefinedFields: UserDefinedField[],
  candidates: Record<string, string[]>
): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create: (state) => buildFrontmatterPropertiesDecorations(state, userDefinedFields, candidates),
    update: (_decorations, transaction) => buildFrontmatterPropertiesDecorations(
      transaction.state,
      userDefinedFields,
      candidates
    ),
    provide: (field) => EditorView.decorations.from(field)
  });
}

function createLivePreviewPlugin(
  onOpenLinkRef: React.RefObject<((href: string) => void) | undefined>,
  onOpenWikiLinkRef: React.RefObject<((target: string, heading?: string) => void) | undefined>
) {
  return EditorView.decorations.of((view) => buildLivePreviewDecorations(view, (link) => {
    if (link.type === "markdown" && link.href) {
      onOpenLinkRef.current?.(link.href);
      return;
    }

    if (link.type === "wiki" && link.target) {
      onOpenWikiLinkRef.current?.(link.target, link.heading ?? undefined);
    }
  }));
}

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
  allFilePaths: string[],
  userDefinedFields: UserDefinedField[],
  frontmatterCandidates: Record<string, string[]>,
  onContextMenu: (event: MouseEvent, view: EditorView) => boolean,
  onOpenLinkRef: React.RefObject<((href: string) => void) | undefined>,
  onOpenWikiLinkRef: React.RefObject<((target: string, heading?: string) => void) | undefined>
) {
  return [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    markdown({ extensions: GFM }),
    EditorView.lineWrapping,
    autocompletion({ override: [buildWikiLinkCompletionSource(allFilePaths)] }),
    EditorView.domEventHandlers({
      click: (event, view) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.closest(".cm-live-link")) return false;
        if (event.defaultPrevented || event.button !== 0) return false;

        const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (position === null) return false;

        const link = findClickableLinkAtPosition(view.state.doc, position);
        if (!link) return false;

        event.preventDefault();
        event.stopPropagation();

        if (link.type === "markdown" && link.href) {
          onOpenLinkRef.current?.(link.href);
          return true;
        }

        if (link.type === "wiki" && link.target) {
          onOpenWikiLinkRef.current?.(link.target, link.heading ?? undefined);
          return true;
        }

        return false;
      },
      contextmenu: onContextMenu
    }),
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
      ".cm-line": {
        overflowWrap: "anywhere",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      },
      ".cm-focused": { outline: "none" }
    }),
    EditorView.contentAttributes.of({ spellcheck: settings.spellCheck ? "true" : "false" }),
    ...(settings.showLineNumbers ? [lineNumbers()] : []),
    ...(typewriterMode ? [typewriterExtension] : []),
    createFrontmatterPropertiesField(userDefinedFields, frontmatterCandidates),
    livePreviewTableField,
    createLivePreviewPlugin(onOpenLinkRef, onOpenWikiLinkRef)
  ];
}

export function findClickableLinkAtPosition(
  doc: Text,
  position: number
): ClickableLinkAtPosition | null {
  const line = doc.lineAt(position);
  const offset = position - line.from;

  for (const match of line.text.matchAll(/\[([^\]\n]+)\]\(([^)\n]+)\)/g)) {
    const fullText = match[0];
    const href = match[2];
    const start = match.index ?? 0;

    if (offset >= start && offset <= start + fullText.length) {
      return { href, type: "markdown" };
    }
  }

  for (const match of line.text.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const body = match[1];
    const start = match.index ?? 0;
    const end = start + match[0].length;

    if (offset < start || offset > end) continue;

    const [targetPart] = body.split("|", 2);
    const blockParts = targetPart.trim().split("^", 2);
    const headingParts = blockParts[0].split("#", 2);
    const target = headingParts[0].trim();

    if (!target) return null;

    return { heading: headingParts[1]?.trim() || undefined, target, type: "wiki" };
  }

  return null;
}

function editorContextMenuPosition(x: number, y: number): { x: number; y: number } {
  const margin = 8;
  const estimatedWidth = 220;
  const estimatedHeight = 180;
  const maxX = Math.max(margin, window.innerWidth - estimatedWidth - margin);
  const maxY = Math.max(margin, window.innerHeight - estimatedHeight - margin);

  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY)
  };
}

function readClipboardText(): string {
  if (window.relic?.readClipboardText) {
    return window.relic.readClipboardText();
  }

  return "";
}

async function writeClipboardText(text: string): Promise<void> {
  if (window.relic?.writeClipboardText) {
    window.relic.writeClipboardText(text);
    return;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the textarea fallback.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.left = "-9999px";
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function usesElectronNativeEditorMenu(): boolean {
  return Boolean(window.relic?.readClipboardText && window.relic.writeClipboardText);
}

export function Editor({
  allFilePaths = [],
  content,
  frontmatterCandidates = {},
  onChange,
  onOpenLink,
  onOpenWikiLink,
  settings,
  typewriterMode = false,
  userDefinedFields = [],
  viewRef
}: EditorProps): ReactElement {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const internalViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onOpenLinkRef = useRef(onOpenLink);
  const onOpenWikiLinkRef = useRef(onOpenWikiLink);
  const allFilePathsRef = useRef(allFilePaths);
  const frontmatterCandidatesRef = useRef(frontmatterCandidates);
  const userDefinedFieldsRef = useRef(userDefinedFields);
  const lastSelectionRef = useRef<{ from: number; text: string; to: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    selectionFrom: number;
    selectionText: string;
    selectionTo: number;
    x: number;
    y: number;
  } | null>(null);

  onChangeRef.current = onChange;
  onOpenLinkRef.current = onOpenLink;
  onOpenWikiLinkRef.current = onOpenWikiLink;
  allFilePathsRef.current = allFilePaths;
  frontmatterCandidatesRef.current = frontmatterCandidates;
  userDefinedFieldsRef.current = userDefinedFields;

  const openContextMenu = (event: MouseEvent, view: EditorView): boolean => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest(".cm-live-table")) return false;
    if (usesElectronNativeEditorMenu()) return false;

    event.preventDefault();
    const position = editorContextMenuPosition(event.clientX, event.clientY);
    const selection = view.state.selection.main;
    let clickedPosition: number | null = null;
    try {
      clickedPosition = view.posAtCoords({ x: event.clientX, y: event.clientY });
    } catch {
      clickedPosition = null;
    }
    let selectionFrom = selection.empty ? clickedPosition ?? selection.from : selection.from;
    let selectionTo = selection.empty ? selectionFrom : selection.to;
    let selectionText = "";

    if (selection.empty) {
      const lastSelection = lastSelectionRef.current;
      if (
        lastSelection &&
        clickedPosition !== null &&
        clickedPosition >= lastSelection.from &&
        clickedPosition <= lastSelection.to
      ) {
        selectionFrom = lastSelection.from;
        selectionTo = lastSelection.to;
        selectionText = lastSelection.text;
      }
    } else {
      selectionText = view.state.sliceDoc(selection.from, selection.to);
      lastSelectionRef.current = {
        from: selection.from,
        text: selectionText,
        to: selection.to
      };
    }

    setContextMenu({
      selectionFrom,
      selectionText,
      selectionTo,
      ...position
    });
    return true;
  };

  const openReactContextMenu = (event: React.MouseEvent<HTMLDivElement>): void => {
    const view = internalViewRef.current;
    if (!view) return;
    if (openContextMenu(event.nativeEvent, view)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const closeContextMenu = (): void => setContextMenu(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContextMenu = (event: MouseEvent): void => {
      const view = internalViewRef.current;
      if (!view) return;
      if (openContextMenu(event, view)) event.stopPropagation();
    };
    const handleRightButtonDown = (event: MouseEvent): void => {
      if (event.button !== 2) return;
      const view = internalViewRef.current;
      if (!view) return;
      if (openContextMenu(event, view)) event.stopPropagation();
    };

    container.addEventListener("pointerdown", handleRightButtonDown, true);
    container.addEventListener("mousedown", handleRightButtonDown, true);
    container.addEventListener("mouseup", handleRightButtonDown, true);
    container.addEventListener("auxclick", handleRightButtonDown, true);
    container.addEventListener("contextmenu", handleContextMenu, true);

    return () => {
      container.removeEventListener("pointerdown", handleRightButtonDown, true);
      container.removeEventListener("mousedown", handleRightButtonDown, true);
      container.removeEventListener("mouseup", handleRightButtonDown, true);
      container.removeEventListener("auxclick", handleRightButtonDown, true);
      container.removeEventListener("contextmenu", handleContextMenu, true);
    };
  });

  const copySelection = (): void => {
    const view = internalViewRef.current;
    const selection = view?.state.selection.main;
    const selectionText = view && selection && !selection.empty
      ? view.state.sliceDoc(selection.from, selection.to)
      : contextMenu?.selectionText ?? "";
    if (!selectionText) return;
    void writeClipboardText(selectionText);
  };

  const cutSelection = (): void => {
    const view = internalViewRef.current;
    if (!view) return;
    const selection = view.state.selection.main;
    const selectionText = !selection.empty
      ? view.state.sliceDoc(selection.from, selection.to)
      : contextMenu?.selectionText ?? "";
    if (!selectionText) return;
    const from = !selection.empty ? selection.from : contextMenu?.selectionFrom ?? selection.from;
    const to = !selection.empty ? selection.to : contextMenu?.selectionTo ?? selection.to;

    void writeClipboardText(selectionText);
    view.dispatch({
      changes: { from, insert: "", to },
      selection: { anchor: from }
    });
    view.focus();
  };

  const pasteClipboard = async (): Promise<void> => {
    const view = internalViewRef.current;
    if (!view) return;
    const from = contextMenu?.selectionFrom ?? view.state.selection.main.from;
    const to = contextMenu?.selectionTo ?? view.state.selection.main.to;
    let text = "";

    if (window.relic?.readClipboardText) {
      text = readClipboardText();
    } else if (navigator.clipboard?.readText) {
      try {
        text = await navigator.clipboard.readText();
      } catch {
        text = "";
      }
    }

    if (text === "") {
      view.dispatch({ selection: { anchor: from, head: to } });
      view.focus();
      document.execCommand("paste");
      return;
    }

    view.dispatch({
      changes: { from, insert: text, to },
      selection: { anchor: from + text.length }
    });
    view.focus();
  };

  const selectAll = (): void => {
    const view = internalViewRef.current;
    if (!view) return;
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    view.focus();
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest(".editor-context-menu")) return;
      closeContextMenu();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeContextMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = buildExtensions(
      settings,
      typewriterMode,
      onChangeRef,
      allFilePathsRef.current,
      userDefinedFieldsRef.current,
      frontmatterCandidatesRef.current,
      openContextMenu,
      onOpenLinkRef,
      onOpenWikiLinkRef
    );
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

  useEffect(() => {
    const view = internalViewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (currentContent === content) return;

    view.dispatch({
      changes: {
        from: 0,
        insert: content,
        to: view.state.doc.length
      }
    });
  }, [content]);

  // 設定・タイプライターモード変更時にエディタを再生成
  useEffect(() => {
    const view = internalViewRef.current;

    if (!view) return;

    const currentContent = view.state.doc.toString();

    view.destroy();
    internalViewRef.current = null;

    if (!containerRef.current) return;

    const extensions = buildExtensions(
      settings,
      typewriterMode,
      onChangeRef,
      allFilePathsRef.current,
      userDefinedFieldsRef.current,
      frontmatterCandidatesRef.current,
      openContextMenu,
      onOpenLinkRef,
      onOpenWikiLinkRef
    );
    const state = EditorState.create({ doc: currentContent, extensions });
    const nextView = new EditorView({ state, parent: containerRef.current });

    internalViewRef.current = nextView;

    if (viewRef) viewRef.current = nextView;
  }, [frontmatterCandidates, settings, typewriterMode, userDefinedFields, viewRef]);

  return (
    <>
      <div className="cm-editor-container" onContextMenuCapture={openReactContextMenu} ref={containerRef} />
      {contextMenu ? createPortal(
        <div
          className="tab-context-menu editor-context-menu"
          role="menu"
          style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 1000 }}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => {
              copySelection();
              closeContextMenu();
            }}
            role="menuitem"
            type="button"
          >
            {t("editor.copy")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => {
              cutSelection();
              closeContextMenu();
            }}
            role="menuitem"
            type="button"
          >
            {t("editor.cut")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => {
              void pasteClipboard();
              closeContextMenu();
            }}
            role="menuitem"
            type="button"
          >
            {t("editor.paste")}
          </button>
          <div className="tab-context-menu-separator" />
          <button
            className="tab-context-menu-item"
            onClick={() => {
              selectAll();
              closeContextMenu();
            }}
            role="menuitem"
            type="button"
          >
            {t("editor.selectAll")}
          </button>
        </div>,
        document.body
      ) : null}
    </>
  );
}
