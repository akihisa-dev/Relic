import { EditorState, StateEffect, StateField, type Text } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import * as yaml from "js-yaml";

import type { UserDefinedField } from "../shared/ipc";
import { fixedStatusValues } from "../shared/status";
import { setEditorEditable } from "./editorEditable";

export interface FrontmatterBlock {
  bodyFrom: number;
  data: Record<string, unknown>;
  endLine: number;
  from: number;
  startLine: number;
  to: number;
  yamlText: string;
}

export type FrontmatterDialogRequest =
  | { type: "array-value"; key: string }
  | { type: "property" };

const topLevelYamlFieldPattern = /^([^#\s][^:]*):(?:\s|$)/;
export const frontmatterFieldNamePattern = /^[^#\s:][^\r\n:]*$/;
const fixedFrontmatterFieldNames = ["aliases", "tags", "status", "chronicle", "plannedDate", "actualDate"];
export const frontmatterDialogRequestEvent = "relic-frontmatter-dialog-request";
const frontmatterCollapsedEffect = StateEffect.define<boolean>();
export const frontmatterCollapsedField = StateField.define<boolean>({
  create: () => false,
  update: (value, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(frontmatterCollapsedEffect)) return effect.value;
    }

    return value;
  }
});
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
  return isFixedDateRangeField(key) || key === "aliases" || key === "tags" || key === "chronicle" || Boolean(field);
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
class FrontmatterPropertiesWidget extends WidgetType {
  constructor(
    private readonly block: FrontmatterBlock,
    private readonly userDefinedFields: UserDefinedField[],
    private readonly candidates: Record<string, string[]>,
    private readonly lineNumber: number,
    private readonly collapsed: boolean
  ) {
    super();
  }

  eq(other: FrontmatterPropertiesWidget): boolean {
    return this.block.from === other.block.from &&
      this.block.to === other.block.to &&
      JSON.stringify(this.block.data) === JSON.stringify(other.block.data) &&
      this.lineNumber === other.lineNumber &&
      this.collapsed === other.collapsed;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("section");
    wrapper.className = "cm-frontmatter-properties";
    wrapper.dataset.collapsed = String(this.collapsed);
    wrapper.contentEditable = "false";
    wrapper.addEventListener("focusin", () => setEditorEditable(view, false));
    wrapper.addEventListener("focusout", (event) => {
      const nextTarget = (event as FocusEvent).relatedTarget;
      if (!(nextTarget instanceof Node) || !wrapper.contains(nextTarget)) {
        setEditorEditable(view, true);
      }
    });

    if (this.lineNumber !== this.block.startLine) {
      if (this.collapsed) {
        wrapper.classList.add("cm-frontmatter-properties--collapsed-line");
        return wrapper;
      }

      const row = this.rowForLine(view);
      if (row) {
        wrapper.append(row);
      } else if (this.lineNumber === this.block.endLine) {
        wrapper.append(this.addRow(view));
      } else {
        wrapper.classList.add("cm-frontmatter-properties--spacer");
      }
      return wrapper;
    }

    const header = document.createElement("button");
    header.className = "cm-frontmatter-header";
    header.ariaExpanded = String(!this.collapsed);
    header.title = this.collapsed ? "プロパティを開く" : "プロパティを閉じる";
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

    header.addEventListener("click", (event) => {
      event.preventDefault();
      view.dispatch({ effects: frontmatterCollapsedEffect.of(!this.collapsed) });
    });

    wrapper.append(header);
    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
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
      : isFixedDateRangeField(key)
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

  private addRow(view: EditorView): HTMLElement {
    const row = document.createElement("div");
    row.className = "cm-frontmatter-row cm-frontmatter-add-row";

    const icon = document.createElement("span");
    icon.className = "cm-frontmatter-row-icon";
    icon.textContent = "+";

    const label = document.createElement("span");
    label.className = "cm-frontmatter-key";
    label.textContent = "追加";

    const help = document.createElement("span");
    help.className = "cm-frontmatter-add-help";
    help.textContent = "プロパティを追加";

    const button = document.createElement("button");
    button.className = "cm-frontmatter-add";
    button.title = "プロパティを追加";
    button.type = "button";
    button.textContent = "+";
    this.isolateWidgetControl(button);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      requestFrontmatterDialog(view, { type: "property" });
    });

    row.append(icon, label, help, button);
    return row;
  }

  private isolateWidgetControl(element: HTMLElement): void {
    for (const eventName of [
      "beforeinput",
      "input",
      "keydown",
      "keyup",
      "compositionstart",
      "compositionupdate",
      "compositionend",
      "pointerdown",
      "mousedown",
      "click"
    ]) {
      element.addEventListener(eventName, (event) => event.stopPropagation());
    }
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
    if (field?.type === "select") return this.selectInput(view, key, value, field, writeAsArray);

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

  private selectInput(view: EditorView, key: string, value: unknown, field: UserDefinedField, writeAsArray = false): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-frontmatter-input-wrap";
    const select = document.createElement("select");
    select.className = "cm-frontmatter-input cm-frontmatter-select";

    const currentValue = this.scalarInputValue(value, field);
    const choices = this.choicesFor(key, field);
    const options = currentValue && !choices.includes(currentValue) ? [currentValue, ...choices] : choices;

    if (!currentValue) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "";
      select.append(option);
    }

    for (const choice of options) {
      const option = document.createElement("option");
      option.value = choice;
      option.textContent = choice;
      select.append(option);
    }

    select.value = currentValue;
    select.addEventListener("change", () => {
      const nextValue = this.parseScalarValue(select.value, field);
      this.updateField(view, key, writeAsArray && nextValue !== undefined ? [nextValue] : nextValue);
    });

    wrap.append(select);
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

    const addButton = document.createElement("button");
    addButton.className = "cm-frontmatter-pill-add";
    addButton.title = "値を追加";
    addButton.type = "button";
    addButton.textContent = "+";
    this.isolateWidgetControl(addButton);
    addButton.addEventListener("click", () => requestFrontmatterDialog(view, { key, type: "array-value" }));
    wrap.append(addButton);

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
    setEditorEditable(view, true);
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
    if (isFixedDateRangeField(key) && typeof value === "string" && parseDateInput(value) !== null) return value;
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
    if (key === "status") return { name: key, type: "select", choices: [...fixedStatusValues] };
    if (isFixedDateRangeField(key)) return { name: key, type: "date" };
    return this.userDefinedFields.find((field) => field.name === key);
  }

  private choicesFor(key: string, field?: UserDefinedField): string[] {
    if (key === "aliases") return [];
    if (key === "status") return [...fixedStatusValues];
    return Array.from(new Set([...(field?.choices ?? []), ...(this.candidates[key] ?? [])])).sort((a, b) => a.localeCompare(b));
  }

  private availableFieldNames(): string[] {
    const usedKeys = new Set(Object.keys(this.block.data));
    return Array.from(new Set([
      ...fixedFrontmatterFieldNames,
      ...this.userDefinedFields.map((field) => field.name),
      ...Object.keys(this.candidates)
    ]))
      .filter((key) => !usedKeys.has(key))
      .sort((a, b) => a.localeCompare(b));
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

function isFixedDateRangeField(key: string): boolean {
  return key === "date" || key === "plannedDate" || key === "actualDate";
}
export function findFrontmatterLineRange(doc: Text): { end: number; start: number } | null {
  if (doc.lines < 2 || doc.line(1).text.trim() !== "---") return null;

  for (let lineNumber = 2; lineNumber <= doc.lines; lineNumber += 1) {
    if (doc.line(lineNumber).text.trim() === "---") {
      return { end: lineNumber, start: 1 };
    }
  }

  return null;
}

export function findFrontmatterBlock(state: EditorState): FrontmatterBlock | null {
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
export function requestFrontmatterDialog(view: EditorView, detail: FrontmatterDialogRequest): void {
  view.dom.dispatchEvent(new CustomEvent<FrontmatterDialogRequest>(frontmatterDialogRequestEvent, {
    bubbles: true,
    detail
  }));
}

export function appendFrontmatterField(view: EditorView, key: string): void {
  const block = findFrontmatterBlock(view.state);
  if (!block) return;

  const closeLine = view.state.doc.line(block.endLine);
  view.dispatch({
    changes: { from: closeLine.from, insert: `${key}:\n` }
  });
}

export function appendFrontmatterArrayValue(view: EditorView, key: string, value: string): void {
  const block = findFrontmatterBlock(view.state);
  if (!block) return;

  const currentValue = block.data[key];
  const nextValue = [
    ...(Array.isArray(currentValue) ? currentValue : currentValue === null || currentValue === undefined ? [] : [currentValue]),
    value
  ];
  const serialized = `${key}: [${nextValue.map((item) => JSON.stringify(String(item))).join(", ")}]`;
  const lines = block.yamlText.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  const entry = findTopLevelYamlFieldEntries(lines).find((item) => item.key === key);

  if (!entry) {
    const closeLine = view.state.doc.line(block.endLine);
    view.dispatch({ changes: { from: closeLine.from, insert: `${serialized}\n` } });
    return;
  }

  const from = view.state.doc.line(block.startLine + 1 + entry.start).from;
  const to = view.state.doc.line(block.startLine + entry.end).to;
  view.dispatch({ changes: { from, insert: serialized, to } });
}
export function buildFrontmatterPropertiesDecorations(
  state: EditorState,
  userDefinedFields: UserDefinedField[] = [],
  candidates: Record<string, string[]> = {}
): DecorationSet {
  const block = findFrontmatterBlock(state);
  if (!block) return Decoration.none;

  const collapsed = state.field(frontmatterCollapsedField, false) ?? false;
  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  for (let lineNumber = block.startLine; lineNumber <= block.endLine; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const widget = new FrontmatterPropertiesWidget(block, userDefinedFields, candidates, lineNumber, collapsed);
    ranges.push({
      from: line.from,
      to: line.to,
      deco: line.from < line.to
        ? Decoration.replace({ widget })
        : Decoration.widget({ widget })
    });

    if (collapsed && lineNumber !== block.startLine) {
      ranges.push({
        from: line.from,
        to: line.from,
        deco: Decoration.line({
          attributes: { "aria-hidden": "true" },
          class: "cm-frontmatter-line-collapsed"
        })
      });
    }
  }

  return Decoration.set(ranges.map((range) => range.deco.range(range.from, range.to)), true);
}
export function createFrontmatterPropertiesField(
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
