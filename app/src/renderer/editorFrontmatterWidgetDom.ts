import { EditorView } from "@codemirror/view";

import type { FrontmatterDateFormat, UserDefinedField } from "../shared/ipc";
import {
  fieldFor,
  findTopLevelYamlFieldEntries,
  type FrontmatterBlock
} from "./editorFrontmatterModel";
import {
  createFrontmatterValueInput,
  type FrontmatterFieldUpdater
} from "./editorFrontmatterWidgetInputs";
import type { Translator } from "./i18n";

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
  const entry = findTopLevelYamlFieldEntries(lines).find((item) => item.start === yamlLineIndex);
  if (!entry || !Object.prototype.hasOwnProperty.call(block.data, entry.key)) return null;

  return createFrontmatterRow({
    candidates,
    dateFormat,
    key: entry.key,
    t,
    updateField,
    userDefinedFields,
    value: block.data[entry.key],
    view
  });
}

function createFrontmatterRow({
  candidates,
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
  key: string;
  t: Translator;
  updateField: FrontmatterFieldUpdater;
  userDefinedFields: UserDefinedField[];
  value: unknown;
  view: EditorView;
}): HTMLElement {
  const row = document.createElement("div");
  row.className = "cm-frontmatter-row";

  const drag = document.createElement("span");
  drag.className = "cm-frontmatter-row-icon";
  drag.textContent = "☰";

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
  removeButton.textContent = "×";
  removeButton.addEventListener("click", () => updateField(view, key, undefined));

  row.append(drag, label, input, removeButton);
  return row;
}
