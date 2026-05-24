import { EditorView } from "@codemirror/view";
import * as yaml from "js-yaml";

import type { UserDefinedField } from "../shared/ipc";
import {
  choicesFor,
  chronicleInputValue,
  dateInputValue,
  firstArrayValue,
  inputTypeFor,
  isChronicleField,
  isEditableScalar,
  isFixedDateRangeField,
  isSingleValueField,
  parseChronicleYearInput,
  parseDateInput,
  parseScalarValue,
  requestFrontmatterDialog,
  scalarInputValue
} from "./editorFrontmatterModel";
import type { Translator } from "./i18n";

export type FrontmatterFieldUpdater = (view: EditorView, key: string, value: unknown) => void;

export function createFrontmatterValueInput({
  candidates,
  field,
  key,
  t,
  updateField,
  value,
  view
}: {
  candidates: Record<string, string[]>;
  field?: UserDefinedField;
  key: string;
  t: Translator;
  updateField: FrontmatterFieldUpdater;
  value: unknown;
  view: EditorView;
}): HTMLElement {
  if (isChronicleField(key)) return chronicleInput(view, key, Array.isArray(value) ? value : [], updateField);
  if (isFixedDateRangeField(key)) {
    return dateRangeInput(
      view,
      key,
      Array.isArray(value) ? value : value === null || value === undefined ? [] : [value],
      updateField
    );
  }
  if (field?.type === "boolean") return booleanInput(view, key, firstArrayValue(value), updateField, true);
  if (isSingleValueField(field)) return scalarInput(view, key, firstArrayValue(value), field, candidates, updateField, true);
  if (field?.type === "multi-select" || key === "aliases" || key === "tags" || Array.isArray(value)) {
    return arrayInput(
      view,
      key,
      Array.isArray(value) ? value : value === null || value === undefined ? [] : [value],
      updateField,
      t
    );
  }
  if (isEditableScalar(value)) return scalarInput(view, key, value, field, candidates, updateField);

  return complexValueInput(view, key, value, updateField);
}

function scalarInput(
  view: EditorView,
  key: string,
  value: unknown,
  field: UserDefinedField | undefined,
  candidates: Record<string, string[]>,
  updateField: FrontmatterFieldUpdater,
  writeAsArray = false
): HTMLElement {
  if (field?.type === "select") return selectInput(view, key, value, field, candidates, updateField, writeAsArray);

  const wrap = document.createElement("span");
  wrap.className = "cm-frontmatter-input-wrap";
  const input = document.createElement("input");
  input.className = "cm-frontmatter-input";
  input.type = inputTypeFor(field);
  input.value = scalarInputValue(value, field);
  const datalist = createDatalist(input, key, choicesFor(key, field, candidates));

  input.addEventListener("change", () => {
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
  key: string,
  value: unknown[],
  updateField: FrontmatterFieldUpdater
): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "cm-frontmatter-input-wrap cm-frontmatter-chronicle";

  const startInput = document.createElement("input");
  startInput.className = "cm-frontmatter-input";
  startInput.type = "number";
  startInput.value = chronicleInputValue(value[0]);

  const endInput = document.createElement("input");
  endInput.className = "cm-frontmatter-input";
  endInput.placeholder = "end";
  endInput.type = "number";
  endInput.value = value.length > 1 ? chronicleInputValue(value[1]) : "";

  const commit = (): void => {
    const startYear = parseChronicleYearInput(startInput.value);
    const endYear = parseChronicleYearInput(endInput.value);

    if (startYear === null) {
      updateField(view, key, undefined);
      return;
    }

    if (endYear === null || endYear === startYear) {
      updateField(view, key, [startYear]);
      return;
    }

    updateField(view, key, startYear <= endYear ? [startYear, endYear] : [endYear, startYear]);
  };

  startInput.addEventListener("change", commit);
  endInput.addEventListener("change", commit);
  wrap.append(startInput, endInput);
  return wrap;
}

function dateRangeInput(
  view: EditorView,
  key: string,
  value: unknown[],
  updateField: FrontmatterFieldUpdater
): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "cm-frontmatter-input-wrap cm-frontmatter-date-range";

  const startInput = document.createElement("input");
  startInput.className = "cm-frontmatter-input";
  startInput.type = "date";
  startInput.value = dateInputValue(value[0]);

  const endInput = document.createElement("input");
  endInput.className = "cm-frontmatter-input";
  endInput.type = "date";
  endInput.value = value.length > 1 ? dateInputValue(value[1]) : "";

  const commit = (): void => {
    const startDate = parseDateInput(startInput.value);
    const endDate = parseDateInput(endInput.value);

    if (startDate === null) {
      updateField(view, key, undefined);
      return;
    }

    if (endDate === null || endDate === startDate) {
      updateField(view, key, [startDate]);
      return;
    }

    updateField(view, key, startDate <= endDate ? [startDate, endDate] : [endDate, startDate]);
  };

  startInput.addEventListener("change", commit);
  endInput.addEventListener("change", commit);
  wrap.append(startInput, endInput);
  return wrap;
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
      updateField(view, key, value.map(String).filter((_, itemIndex) => itemIndex !== index));
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
