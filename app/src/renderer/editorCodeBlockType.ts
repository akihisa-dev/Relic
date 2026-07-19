import type { EditorView } from "@codemirror/view";

import type { Translator } from "./i18nModel";

export type SpecialCodeBlockType = "flavortext" | "mermaid" | "d2";

const specialCodeBlockTypes: readonly SpecialCodeBlockType[] = ["flavortext", "mermaid", "d2"];
const currentLanguageOptionValue = "__current_language__";

export function createCodeBlockTypeSelect(
  view: EditorView,
  blockFrom: number,
  currentLanguage: string | null,
  t: Translator
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "cm-live-code-block-type";
  select.setAttribute("aria-label", t("editor.codeBlockType"));
  select.dataset.blockFrom = String(blockFrom);
  configureCodeBlockTypeSelect(select, currentLanguage, t);

  for (const eventName of ["click", "mousedown", "pointerdown"] as const) {
    select.addEventListener(eventName, (event) => event.stopPropagation());
  }
  select.addEventListener("change", (event) => {
    event.stopPropagation();
    if (select.value === currentLanguageOptionValue) return;
    const currentBlockFrom = Number(select.dataset.blockFrom);
    if (!Number.isInteger(currentBlockFrom)) return;
    setCodeBlockType(view, currentBlockFrom, select.value as SpecialCodeBlockType | "");
  });

  return select;
}

export function configureCodeBlockTypeSelect(
  select: HTMLSelectElement,
  currentLanguage: string | null,
  t: Translator
): void {
  const normalizedLanguage = normalizedSpecialCodeBlockType(currentLanguage);
  const options: HTMLOptionElement[] = [];

  if (currentLanguage && !normalizedLanguage) {
    options.push(codeBlockTypeOption(currentLanguage, currentLanguageOptionValue));
  }
  options.push(codeBlockTypeOption(t("editor.codeBlockLanguageFallback"), ""));
  options.push(codeBlockTypeOption(t("editor.codeBlockTypeFlavorText"), "flavortext"));
  options.push(codeBlockTypeOption(t("editor.codeBlockTypeMermaid"), "mermaid"));
  options.push(codeBlockTypeOption(t("editor.codeBlockTypeD2"), "d2"));
  select.replaceChildren(...options);
  select.value = normalizedLanguage ?? (currentLanguage ? currentLanguageOptionValue : "");
}

export function setCodeBlockType(
  view: EditorView,
  blockFrom: number,
  type: SpecialCodeBlockType | ""
): void {
  const openingLine = view.state.doc.lineAt(blockFrom);
  const nextOpeningLine = codeBlockOpeningLineWithType(openingLine.text, type);
  if (nextOpeningLine === null || nextOpeningLine === openingLine.text) return;

  view.dispatch({
    changes: {
      from: openingLine.from,
      insert: nextOpeningLine,
      to: openingLine.to
    }
  });
}

export function codeBlockOpeningLineWithType(
  openingLine: string,
  type: SpecialCodeBlockType | ""
): string | null {
  const match = /^( {0,3})(`{3,}|~{3,})/.exec(openingLine);
  if (!match) return null;

  return `${match[1]}${match[2]}${type}`;
}

function normalizedSpecialCodeBlockType(language: string | null): SpecialCodeBlockType | null {
  const normalized = language?.trim().toLowerCase();
  return specialCodeBlockTypes.includes(normalized as SpecialCodeBlockType)
    ? normalized as SpecialCodeBlockType
    : null;
}

function codeBlockTypeOption(label: string, value: string): HTMLOptionElement {
  const option = document.createElement("option");
  option.textContent = label;
  option.value = value;
  return option;
}
