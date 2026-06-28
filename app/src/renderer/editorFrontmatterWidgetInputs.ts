import { EditorView } from "@codemirror/view";
import * as yaml from "js-yaml";

import type { FrontmatterDateFormat, UserDefinedField } from "../shared/ipc";
import {
  choicesFor,
  dateInputValue,
  firstArrayValue,
  inputTypeFor,
  isChronicleField,
  isEditableScalar,
  isSingleValueField,
  parseChronicleYearInput,
  parseDateInputForFormat,
  parseScalarValue,
  requestFrontmatterDialog,
  scalarInputValue
} from "./editorFrontmatterModel";
import type { Translator } from "./i18nModel";

export type FrontmatterFieldUpdater = (view: EditorView, key: string, value: unknown) => void;

export function createFrontmatterValueInput({
  candidates,
  dateFormat,
  field,
  key,
  t,
  updateField,
  value,
  view
}: {
  candidates: Record<string, string[]>;
  dateFormat: FrontmatterDateFormat;
  field?: UserDefinedField;
  key: string;
  t: Translator;
  updateField: FrontmatterFieldUpdater;
  value: unknown;
  view: EditorView;
}): HTMLElement {
  if (isChronicleField(key)) return chronicleInput(view, Array.isArray(value) ? value : [], updateField, t, candidates[key] ?? []);
  if (field?.type === "boolean") return booleanInput(view, key, firstArrayValue(value), updateField, true);
  if (isSingleValueField(field)) {
    return scalarInput(view, key, firstArrayValue(value), field, candidates, updateField, dateFormat, true);
  }
  if (!field && Array.isArray(value)) {
    return scalarInput(view, key, firstArrayValue(value), undefined, {}, updateField, dateFormat, true);
  }
  if (field?.type === "multi-select" || key === "aliases" || key === "tags" || Array.isArray(value)) {
    return arrayInput(
      view,
      key,
      Array.isArray(value) ? value : value === null || value === undefined ? [] : [value],
      updateField,
      t
    );
  }
  if (isEditableScalar(value)) return scalarInput(view, key, value, field, candidates, updateField, dateFormat);

  return complexValueInput(view, key, value, updateField);
}

function scalarInput(
  view: EditorView,
  key: string,
  value: unknown,
  field: UserDefinedField | undefined,
  candidates: Record<string, string[]>,
  updateField: FrontmatterFieldUpdater,
  dateFormat: FrontmatterDateFormat,
  writeAsArray = false
): HTMLElement {
  if (field?.type === "select") return selectInput(view, key, value, field, candidates, updateField, writeAsArray);

  const wrap = document.createElement("span");
  wrap.className = "cm-frontmatter-input-wrap";
  const input = document.createElement("input");
  input.className = "cm-frontmatter-input";
  input.type = inputTypeFor(field);
  input.value = field?.type === "date"
    ? dateInputValue(value)
    : scalarInputValue(value, field);
  const datalist = field ? createDatalist(input, key, choicesFor(key, field, candidates)) : null;

  input.addEventListener("change", () => {
    if (field?.type === "date") {
      const nextValue = parseDateTextInput(input, dateFormat);
      if (nextValue === null) return;
      updateField(view, key, writeAsArray && nextValue !== undefined ? [nextValue] : nextValue);
      return;
    }

    const nextValue = parseScalarValue(input.value, field);
    updateField(view, key, writeAsArray && nextValue !== undefined ? [nextValue] : nextValue);
  });

  wrap.append(input);
  if (datalist) wrap.append(datalist);
  return wrap;
}

function selectInput(
  view: EditorView,
  key: string,
  value: unknown,
  field: UserDefinedField,
  candidates: Record<string, string[]>,
  updateField: FrontmatterFieldUpdater,
  writeAsArray = false
): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "cm-frontmatter-input-wrap";
  const select = document.createElement("select");
  select.className = "cm-frontmatter-input cm-frontmatter-select";

  const currentValue = scalarInputValue(value, field);
  const choices = choicesFor(key, field, candidates);
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
    const nextValue = parseScalarValue(select.value, field);
    updateField(view, key, writeAsArray && nextValue !== undefined ? [nextValue] : nextValue);
  });

  wrap.append(select);
  return wrap;
}

function complexValueInput(
  view: EditorView,
  key: string,
  value: unknown,
  updateField: FrontmatterFieldUpdater
): HTMLElement {
  const textarea = document.createElement("textarea");
  textarea.className = "cm-frontmatter-yaml-input";
  textarea.rows = 3;
  textarea.spellcheck = false;
  textarea.value = yaml.dump(value, { lineWidth: -1 }).trimEnd();

  textarea.addEventListener("change", () => {
    try {
      textarea.removeAttribute("aria-invalid");
      updateField(view, key, yaml.load(textarea.value));
    } catch {
      textarea.setAttribute("aria-invalid", "true");
    }
  });

  return textarea;
}

function booleanInput(
  view: EditorView,
  key: string,
  value: unknown,
  updateField: FrontmatterFieldUpdater,
  writeAsArray = false
): HTMLElement {
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
    updateField(view, key, writeAsArray ? [input.checked] : input.checked);
  });

  label.append(input, text);
  return label;
}

function chronicleInput(
  view: EditorView,
  value: unknown[],
  updateField: FrontmatterFieldUpdater,
  t: Translator,
  calendarCandidates: string[]
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "cm-frontmatter-input-wrap cm-frontmatter-chronicle cm-frontmatter-chronicle-list";
  const entries = normalizeChronicleEntries(value);

  const commit = (nextEntries: ChronicleFormEntry[]): void => {
    updateField(view, "chronicle", nextEntries.map(serializeChronicleEntry));
  };

  entries.forEach((entry, index) => {
    wrap.append(chronicleEntryInput({
      calendarCandidates,
      entry,
      index,
      onDelete: () => commit(entries.filter((_item, entryIndex) => entryIndex !== index)),
      onUpdate: (nextEntry) => commit(entries.map((item, entryIndex) => entryIndex === index ? nextEntry : item)),
      t
    }));
  });

  const addButton = document.createElement("button");
  addButton.className = "cm-frontmatter-pill-add";
  addButton.ariaLabel = t("frontmatter.addValue");
  addButton.title = t("frontmatter.addValue");
  addButton.textContent = "+";
  addButton.type = "button";
  addButton.addEventListener("click", () => commit([...entries, emptyChronicleEntry()]));
  wrap.append(addButton);

  return wrap;
}

function parseDateTextInput(input: HTMLInputElement, dateFormat: FrontmatterDateFormat): string | null | undefined {
  const rawValue = input.value.trim();
  if (rawValue === "") {
    input.removeAttribute("aria-invalid");
    return undefined;
  }

  const parsedValue = parseDateInputForFormat(rawValue, dateFormat);
  if (parsedValue === null) {
    input.setAttribute("aria-invalid", "true");
    return null;
  }

  input.removeAttribute("aria-invalid");
  return parsedValue;
}

interface ChronicleFormEntry {
  calendarName: string;
  endMonth: string;
  endYear: string;
  startMonth: string;
  startYear: string;
}

function chronicleEntryInput({
  calendarCandidates,
  entry,
  index,
  onDelete,
  onUpdate,
  t
}: {
  calendarCandidates: string[];
  entry: ChronicleFormEntry;
  index: number;
  onDelete: () => void;
  onUpdate: (entry: ChronicleFormEntry) => void;
  t: Translator;
}): HTMLElement {
  const row = document.createElement("div");
  row.className = "cm-frontmatter-chronicle-entry";
  const error = document.createElement("span");
  error.className = "cm-frontmatter-input-error";

  const calendarInput = chronicleCalendarSelect(`chronicle-${index}-calendar`, entry.calendarName, calendarCandidates);
  const startYearInput = chronicleTextInput(`chronicle-${index}-start-year`, entry.startYear, t("frontmatter.rangeStart"));
  const startMonthInput = chronicleTextInput(`chronicle-${index}-start-month`, entry.startMonth, "月");
  const endYearInput = chronicleTextInput(`chronicle-${index}-end-year`, entry.endYear, t("frontmatter.rangeEnd"));
  const endMonthInput = chronicleTextInput(`chronicle-${index}-end-month`, entry.endMonth, "月");

  const readEntry = (): ChronicleFormEntry => ({
    calendarName: calendarInput.value.trim(),
    endMonth: endMonthInput.value.trim(),
    endYear: endYearInput.value.trim(),
    startMonth: startMonthInput.value.trim(),
    startYear: startYearInput.value.trim()
  });

  const commit = (): void => {
    const next = readEntry();
    const validation = validateChronicleEntry(next);
    error.textContent = validation;
    for (const input of [calendarInput, startYearInput, startMonthInput, endYearInput, endMonthInput]) {
      if (validation) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
    if (!validation) onUpdate(next);
  };

  for (const input of [calendarInput, startYearInput, startMonthInput, endYearInput, endMonthInput]) {
    input.addEventListener("change", commit);
  }

  const deleteButton = document.createElement("button");
  deleteButton.className = "cm-frontmatter-pill-remove";
  deleteButton.textContent = "×";
  deleteButton.type = "button";
  deleteButton.addEventListener("click", onDelete);

  row.append(calendarInput, startYearInput, startMonthInput, endYearInput, endMonthInput, deleteButton, error);
  return row;
}

function chronicleCalendarSelect(label: string, value: string, candidates: string[]): HTMLSelectElement {
  const select = document.createElement("select");
  select.ariaLabel = label;
  select.className = "cm-frontmatter-input cm-frontmatter-select";
  const options = chronicleCalendarOptions(value, candidates);

  for (const optionValue of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    select.append(option);
  }

  select.value = value.trim() || options[0] || "";
  return select;
}

function chronicleCalendarOptions(value: string, candidates: string[]): string[] {
  const currentValue = value.trim();
  const options = candidates.reduce<string[]>((items, candidate) => {
    const option = candidate.trim();
    if (option && !items.includes(option)) items.push(option);
    return items;
  }, []);

  if (currentValue && !options.includes(currentValue)) return [currentValue, ...options];
  if (options.length > 0) return options;
  return [currentValue || "メイン暦"];
}

function chronicleTextInput(label: string, value: string, placeholder: string): HTMLInputElement {
  const input = document.createElement("input");
  input.ariaLabel = label;
  input.className = "cm-frontmatter-input";
  input.placeholder = placeholder;
  input.type = "text";
  input.value = value;
  return input;
}

function normalizeChronicleEntries(value: unknown[]): ChronicleFormEntry[] {
  return value.flatMap((entry): ChronicleFormEntry[] => {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string") return [];
    const range = entry[1];
    if (!Array.isArray(range) || range.length !== 2) return [];
    const start = chroniclePointInputValue(range[0]);
    const end = chroniclePointInputValue(range[1]);
    if (!start || !end) return [];

    return [{
      calendarName: entry[0],
      endMonth: end.month,
      endYear: end.year,
      startMonth: start.month,
      startYear: start.year
    }];
  });
}

function chroniclePointInputValue(value: unknown): { month: string; year: string } | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [year, month] = value;
  if (!Number.isInteger(year)) return null;
  if (month !== null && !Number.isInteger(month)) return null;
  return {
    month: month === null ? "" : String(month),
    year: String(year)
  };
}

function emptyChronicleEntry(): ChronicleFormEntry {
  return {
    calendarName: "メイン暦",
    endMonth: "",
    endYear: "1",
    startMonth: "",
    startYear: "1"
  };
}

function serializeChronicleEntry(entry: ChronicleFormEntry): unknown[] {
  const startYear = Number(entry.startYear);
  const endYear = Number(entry.endYear || entry.startYear);
  const startMonth = entry.startMonth ? Number(entry.startMonth) : null;
  const endMonth = entry.endMonth ? Number(entry.endMonth) : null;

  return [
    entry.calendarName.trim(),
    [
      [startYear, startMonth],
      [endYear, endMonth]
    ]
  ];
}

function validateChronicleEntry(entry: ChronicleFormEntry): string | null {
  if (!entry.calendarName.trim()) return "暦名を入力してください。";
  const startYear = parseChronicleYearInput(entry.startYear, true);
  const endYear = entry.endYear ? parseChronicleYearInput(entry.endYear, true) : startYear;
  const startMonth = parseChronicleMonthInput(entry.startMonth);
  const endMonth = entry.endMonth ? parseChronicleMonthInput(entry.endMonth) : null;

  if (startYear === null || endYear === null) return "年は0以外の整数で入力してください。";
  if (startYear === 0 || endYear === 0) return "年は0以外の整数で入力してください。";
  if (startMonth === false || endMonth === false) return "月は1〜12で入力してください。";
  const startValue = startYear * 12 + ((startMonth || 1) - 1);
  const endValue = endYear * 12 + ((endMonth || 1) - 1);
  return startValue <= endValue ? null : "開始年月は終了年月以下にしてください。";
}

function parseChronicleMonthInput(value: string): number | null | false {
  if (!value.trim()) return null;
  if (!/^\d+$/.test(value.trim())) return false;
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : false;
}

function arrayInput(
  view: EditorView,
  key: string,
  value: unknown[],
  updateField: FrontmatterFieldUpdater,
  t: Translator
): HTMLElement {
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
      updateField(view, key, nextItems);
    });

    const removeButton = document.createElement("button");
    removeButton.className = "cm-frontmatter-pill-remove";
    removeButton.title = t("frontmatter.removeValue");
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => {
      updateField(view, key, value.flatMap((item, itemIndex) => (itemIndex === index ? [] : [String(item)])));
    });

    pill.append(itemInput, removeButton);
    wrap.append(pill);
  }

  const addButton = document.createElement("button");
  addButton.className = "cm-frontmatter-pill-add";
  addButton.title = t("frontmatter.addValue");
  addButton.type = "button";
  addButton.textContent = "+";
  isolateFrontmatterWidgetControl(addButton);
  addButton.addEventListener("click", () => requestFrontmatterDialog(view, { key, type: "array-value" }));
  wrap.append(addButton);

  return wrap;
}

export function isolateFrontmatterWidgetControl(element: HTMLElement): void {
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

function createDatalist(input: HTMLInputElement, key: string, values: string[]): HTMLDataListElement | null {
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
