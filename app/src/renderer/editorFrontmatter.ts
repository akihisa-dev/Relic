import type { EditorView } from "@codemirror/view";

import { findFrontmatterBlock, findFrontmatterLineRange, findTopLevelYamlFieldEntries } from "./editorFrontmatterModel";

export {
  availableFieldNames,
  choicesFor,
  chronicleInputValue,
  dateInputValue,
  fieldFor,
  findFrontmatterBlock,
  findFrontmatterLineRange,
  findTopLevelYamlFieldEntries,
  hasInvalidFrontmatterYaml,
  findYamlInlineComment,
  findYamlScalarQuote,
  fixedFrontmatterFieldNames,
  firstArrayValue,
  frontmatterDialogRequestEvent,
  frontmatterFieldNamePattern,
  inputTypeFor,
  isEditableScalar,
  isFixedDateRangeField,
  isSingleValueField,
  isYamlFlowSequence,
  parseChronicleYearInput,
  parseDateInput,
  parseScalarValue,
  requestFrontmatterDialog,
  scalarInputValue,
  serializeData,
  serializeDataPreservingYaml,
  serializeEntryPreservingInlineComment,
  serializeEntryPreservingQuote,
  serializeFlowScalar,
  shouldSerializeArrayAsFlowSequence,
  type FrontmatterBlock,
  type FrontmatterDialogRequest,
  type YamlFieldEntry
} from "./editorFrontmatterModel";
export {
  buildFrontmatterPropertiesDecorations,
  createFrontmatterPropertiesField,
  frontmatterCollapsedField
} from "./editorFrontmatterWidget";

export function appendFrontmatterField(view: EditorView, key: string): void {
  const block = findFrontmatterBlock(view.state);
  if (!block) return;

  const closeLine = view.state.doc.line(block.endLine);
  view.dispatch({
    changes: { from: closeLine.from, insert: `${key}:\n` }
  });
}

export function canAppendOrCreateFrontmatterField(view: EditorView): boolean {
  if (findFrontmatterBlock(view.state)) return true;
  if (view.state.doc.lines > 0 && view.state.doc.line(1).text.trim() === "---") return false;

  return findFrontmatterLineRange(view.state.doc) === null;
}

export function appendOrCreateFrontmatterField(view: EditorView, key: string): void {
  const block = findFrontmatterBlock(view.state);

  if (block) {
    appendFrontmatterField(view, key);
    return;
  }

  if (view.state.doc.lines > 0 && view.state.doc.line(1).text.trim() === "---") return;
  if (findFrontmatterLineRange(view.state.doc) !== null) return;

  view.dispatch({
    changes: {
      from: 0,
      insert: `---\n${key}:\n---\n`
    }
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
