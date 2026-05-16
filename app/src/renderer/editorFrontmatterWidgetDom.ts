import { EditorView } from "@codemirror/view";

import type { UserDefinedField } from "../shared/ipc";
import {
  fieldFor,
  findTopLevelYamlFieldEntries,
  requestFrontmatterDialog,
  type FrontmatterBlock
} from "./editorFrontmatterModel";
import {
  createFrontmatterValueInput,
  isolateFrontmatterWidgetControl,
  type FrontmatterFieldUpdater
} from "./editorFrontmatterWidgetInputs";

export function createFrontmatterHeader({
  collapsed,
  count,
  onToggle
}: {
  collapsed: boolean;
  count: number;
  onToggle: () => void;
}): HTMLElement {
  const header = document.createElement("button");
  header.className = "cm-frontmatter-header";
  header.ariaExpanded = String(!collapsed);
  header.title = collapsed ? "プロパティを開く" : "プロパティを閉じる";
  header.type = "button";

  const icon = document.createElement("span");
  icon.className = "cm-frontmatter-toggle";
  icon.textContent = "⌄";
  const title = document.createElement("span");
  title.textContent = "プロパティ";
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

export function createFrontmatterAddRow(view: EditorView): HTMLElement {
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
  isolateFrontmatterWidgetControl(button);

  button.addEventListener("click", (event) => {
    event.preventDefault();
    requestFrontmatterDialog(view, { type: "property" });
  });

  row.append(icon, label, help, button);
  return row;
}

export function frontmatterRowForLine({
  block,
  candidates,
  lineNumber,
  updateField,
  userDefinedFields,
  view
}: {
  block: FrontmatterBlock;
  candidates: Record<string, string[]>;
  lineNumber: number;
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
    key: entry.key,
    updateField,
    userDefinedFields,
    value: block.data[entry.key],
    view
  });
}

function createFrontmatterRow({
  candidates,
  key,
  updateField,
  userDefinedFields,
  value,
  view
}: {
  candidates: Record<string, string[]>;
  key: string;
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
    field,
    key,
    updateField,
    value,
    view
  });
  const removeButton = document.createElement("button");
  removeButton.className = "cm-frontmatter-remove";
  removeButton.title = "プロパティを削除";
  removeButton.type = "button";
  removeButton.textContent = "×";
  removeButton.addEventListener("click", () => updateField(view, key, undefined));

  row.append(drag, label, input, removeButton);
  return row;
}
