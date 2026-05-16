import { StateEffect, StateField, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import * as yaml from "js-yaml";

import type { UserDefinedField } from "../shared/ipc";
import { setEditorEditable } from "./editorEditable";
import {
  choicesFor,
  chronicleInputValue,
  dateInputValue,
  fieldFor,
  findFrontmatterBlock,
  findTopLevelYamlFieldEntries,
  firstArrayValue,
  inputTypeFor,
  isEditableScalar,
  isFixedDateRangeField,
  isSingleValueField,
  parseChronicleYearInput,
  parseDateInput,
  parseScalarValue,
  requestFrontmatterDialog,
  scalarInputValue,
  serializeDataPreservingYaml,
  type FrontmatterBlock
} from "./editorFrontmatterModel";

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

    const field = fieldFor(key, this.userDefinedFields);
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
          : isEditableScalar(value)
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

  private scalarInput(view: EditorView, key: string, value: unknown, field?: UserDefinedField, writeAsArray = false): HTMLElement {
    if (field?.type === "select") return this.selectInput(view, key, value, field, writeAsArray);

    const wrap = document.createElement("span");
    wrap.className = "cm-frontmatter-input-wrap";
    const input = document.createElement("input");
    input.className = "cm-frontmatter-input";
    input.type = inputTypeFor(field);
    input.value = scalarInputValue(value, field);
    const datalist = this.createDatalist(input, key, choicesFor(key, field, this.candidates));

    input.addEventListener("change", () => {
      const nextValue = parseScalarValue(input.value, field);
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

    const currentValue = scalarInputValue(value, field);
    const choices = choicesFor(key, field, this.candidates);
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
      this.updateField(view, key, writeAsArray && nextValue !== undefined ? [nextValue] : nextValue);
    });

    wrap.append(select);
    return wrap;
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

  private dateRangeInput(view: EditorView, key: string, value: unknown[]): HTMLElement {
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
    const nextYaml = serializeDataPreservingYaml(this.block, nextData, this.userDefinedFields).trimEnd();
    const nextBlock = Object.keys(nextData).length > 0 ? `---\n${nextYaml}\n---` : "";
    view.dispatch({
      changes: {
        from: this.block.from,
        insert: nextBlock,
        to: this.block.to
      }
    });
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
