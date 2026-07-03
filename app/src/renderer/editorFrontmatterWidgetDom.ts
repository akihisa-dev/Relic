import { EditorView } from "@codemirror/view";

import type { FrontmatterDateFormat, UserDefinedField } from "../shared/ipc";
import {
  fieldFor,
  findTopLevelYamlFieldEntries,
  type FrontmatterBlock
} from "./editorFrontmatterModel";
import {
  createFrontmatterValueInput,
  isolateFrontmatterWidgetControl,
  type FrontmatterFieldUpdater
} from "./editorFrontmatterWidgetInputs";
import type { Translator } from "./i18nModel";
import { requestFrontmatterDialog } from "./editorFrontmatterModel";

export function createFrontmatterHeader({
  collapsed,
  count,
  onToggle,
  t
}: {
  collapsed: boolean;
  count: number;
  onToggle: () => void;
  t: Translator;
}): HTMLElement {
  const header = document.createElement("button");
  header.className = "cm-frontmatter-header";
  header.ariaExpanded = String(!collapsed);
  header.title = collapsed ? t("frontmatter.openProperties") : t("frontmatter.closeProperties");
  header.type = "button";

  const icon = document.createElement("span");
  icon.className = "cm-frontmatter-toggle";
  icon.textContent = "⌄";
  const title = document.createElement("span");
  title.textContent = t("frontmatter.properties");
  const countElement = document.createElement("span");
  countElement.className = "cm-frontmatter-count";
  countElement.textContent = String(count);
  header.append(icon, title, countElement);

  header.addEventListener("click", (event) => {
    event.preventDefault();
    onToggle();
  });

  return header;
}

export function frontmatterRowForLine({
  block,
  candidates,
  lineNumber,
  t,
  updateField,
  userDefinedFields,
  view,
  dateFormat
}: {
  block: FrontmatterBlock;
  candidates: Record<string, string[]>;
  dateFormat: FrontmatterDateFormat;
  lineNumber: number;
  t: Translator;
  updateField: FrontmatterFieldUpdater;
  userDefinedFields: UserDefinedField[];
  view: EditorView;
}): HTMLElement | null {
  const yamlLineIndex = lineNumber - block.startLine - 1;
  if (yamlLineIndex < 0 || lineNumber >= block.endLine) return null;

  const lines = block.yamlText.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  const entries = findTopLevelYamlFieldEntries(lines)
    .filter((item) => Object.prototype.hasOwnProperty.call(block.data, item.key));
  const entryIndex = entries.findIndex((item) => item.start === yamlLineIndex);
  const entry = entries[entryIndex];
  if (!entry || !Object.prototype.hasOwnProperty.call(block.data, entry.key)) return null;

  return createFrontmatterRow({
    candidates,
    dateFormat,
    isFirst: entryIndex === 0,
    isLast: entryIndex === entries.length - 1,
    key: entry.key,
    t,
    updateField,
    userDefinedFields,
    value: block.data[entry.key],
    view
  });
}

export function frontmatterRowsForBlock({
  block,
  candidates,
  t,
  updateField,
  userDefinedFields,
  view,
  dateFormat
}: {
  block: FrontmatterBlock;
  candidates: Record<string, string[]>;
  dateFormat: FrontmatterDateFormat;
  t: Translator;
  updateField: FrontmatterFieldUpdater;
  userDefinedFields: UserDefinedField[];
  view: EditorView;
}): HTMLElement[] {
  const lines = block.yamlText.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  const entries = findTopLevelYamlFieldEntries(lines)
    .filter((item) => Object.prototype.hasOwnProperty.call(block.data, item.key));

  return entries.map((entry, entryIndex) => createFrontmatterRow({
    candidates,
    dateFormat,
    isFirst: entryIndex === 0,
    isLast: entryIndex === entries.length - 1,
    key: entry.key,
    t,
    updateField,
    userDefinedFields,
    value: block.data[entry.key],
    view
  }));
}

export function createFrontmatterFooter({
  t,
  view
}: {
  t: Translator;
  view: EditorView;
}): HTMLElement {
  const footer = document.createElement("div");
  footer.className = "cm-frontmatter-footer";

  const button = document.createElement("button");
  button.className = "cm-frontmatter-add-property";
  button.type = "button";
  button.title = t("frontmatter.addProperty");
  const icon = document.createElement("span");
  icon.className = "cm-frontmatter-add-property-icon";
  icon.ariaHidden = "true";
  icon.textContent = "+";
  const label = document.createElement("span");
  label.textContent = t("frontmatter.addProperty");
  button.append(icon, label);
  isolateFrontmatterWidgetControl(button);
  button.addEventListener("click", () => requestFrontmatterDialog(view, { type: "property" }));

  footer.append(button);
  return footer;
}

function createFrontmatterRow({
  candidates,
  isFirst,
  isLast,
  key,
  t,
  updateField,
  userDefinedFields,
  value,
  view,
  dateFormat
}: {
  candidates: Record<string, string[]>;
  dateFormat: FrontmatterDateFormat;
  isFirst: boolean;
  isLast: boolean;
  key: string;
  t: Translator;
  updateField: FrontmatterFieldUpdater;
  userDefinedFields: UserDefinedField[];
  value: unknown;
  view: EditorView;
}): HTMLElement {
  const row = document.createElement("div");
  row.className = "cm-frontmatter-row";
  if (isFirst) row.classList.add("cm-frontmatter-row--first");
  if (isLast) row.classList.add("cm-frontmatter-row--last");

  const drag = document.createElement("span");
  drag.className = "cm-frontmatter-row-icon";
  drag.ariaHidden = "true";

  const label = document.createElement("span");
  label.className = "cm-frontmatter-key";
  label.textContent = key;

  const field = fieldFor(key, userDefinedFields);
  const input = createFrontmatterValueInput({
    candidates,
    dateFormat,
    field,
    key,
    t,
    updateField,
    value,
    view
  });
  const removeButton = document.createElement("button");
  removeButton.className = "cm-frontmatter-remove";
  removeButton.title = t("frontmatter.removeProperty");
  removeButton.type = "button";
  removeButton.ariaLabel = `${key} ${t("frontmatter.removeProperty")}`;
  removeButton.append(createTrashIcon());
  removeButton.addEventListener("click", () => updateField(view, key, undefined));

  row.append(drag, label, input, removeButton);
  return row;
}

export function createTrashIcon(): SVGSVGElement {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("fill", "none");
  icon.setAttribute("height", "18");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("stroke-width", "1.7");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "18");
  for (const pathData of [
    "M10 11v6",
    "M14 11v6",
    "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
    "M3 6h18",
    "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
  ]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    icon.append(path);
  }
  return icon;
}
