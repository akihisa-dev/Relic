import type { EditorView } from "@codemirror/view";

import { findFrontmatterBlock, findTopLevelYamlFieldEntries } from "./editorFrontmatterModel";

export {
  availableFieldNames,
  choicesFor,
  timelineInputValue,
  dateInputValue,
  fieldFor,
  findFrontmatterBlock,
  findFrontmatterLineRange,
  findTopLevelYamlFieldEntries,
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
  parseTimelineYearInput,
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
