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
  chronicleYearRangeInput,
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
  if (isChronicleField(key)) return chronicleInput(view, value, candidates.chronicle ?? [], updateField, t);
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
  value: unknown,
  calendarNames: string[],
  updateField: FrontmatterFieldUpdater,
  t: Translator
): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "cm-frontmatter-input-wrap cm-frontmatter-chronicle";
  const range = chronicleYearRangeInput(value);
  const currentCalendar = typeof value === "object" && value !== null && !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).calendar === "string"
    ? String((value as Record<string, unknown>).calendar)
    : calendarNames[0] ?? "";
  const calendarSelect = document.createElement("select");
  calendarSelect.className = "cm-frontmatter-input cm-frontmatter-select";
  const selectableNames = currentCalendar && !calendarNames.includes(currentCalendar)
    ? [currentCalendar, ...calendarNames]
    : calendarNames;
  for (const name of selectableNames) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.disabled = !calendarNames.includes(name);
    calendarSelect.append(option);
  }
  calendarSelect.value = currentCalendar;
  if (!calendarNames.includes(currentCalendar)) calendarSelect.setAttribute("aria-invalid", "true");
  const startInput = chronicleYearInput("chronicle-start", range.start, t("frontmatter.chronicleStartInput"));
  const endInput = chronicleYearInput("chronicle-end", range.end, t("frontmatter.chronicleEndInput"));
  const commit = (): void => {
    const startRaw = startInput.value.trim();
    const endRaw = endInput.value.trim();
    if (!startRaw) {
      startInput.removeAttribute("aria-invalid");
      endInput.removeAttribute("aria-invalid");
      updateField(view, "chronicle", undefined);
      return;
    }
    const start = parseChronicleYearInput(startRaw);
    const end = endRaw ? parseChronicleYearInput(endRaw) : start;
    const invalid = !calendarNames.includes(calendarSelect.value) || start === null || end === null || start === 0 || end === 0 || start > end;
    if (invalid) {
      startInput.setAttribute("aria-invalid", "true");
      endInput.setAttribute("aria-invalid", "true");
      return;
    }
    startInput.removeAttribute("aria-invalid");
    endInput.removeAttribute("aria-invalid");
    updateField(view, "chronicle", { calendar: calendarSelect.value, start, end });
  };
  calendarSelect.addEventListener("change", commit);
  startInput.addEventListener("input", commit);
  endInput.addEventListener("input", commit);
  wrap.append(calendarSelect, startInput, endInput);
  return wrap;
}

function chronicleYearInput(label: string, value: string, placeholder: string): HTMLInputElement {
  const input = document.createElement("input");
  input.ariaLabel = label;
  input.className = "cm-frontmatter-input";
  input.inputMode = "numeric";
  input.placeholder = placeholder;
  input.type = "text";
  input.value = value;
  return input;
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
