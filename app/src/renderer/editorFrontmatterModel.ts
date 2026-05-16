import { EditorState, type Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import * as yaml from "js-yaml";

import type { UserDefinedField } from "../shared/ipc";
import { fixedStatusValues } from "../shared/status";

export interface FrontmatterBlock {
  bodyFrom: number;
  data: Record<string, unknown>;
  endLine: number;
  from: number;
  startLine: number;
  to: number;
  yamlText: string;
}

export type FrontmatterDialogRequest =
  | { type: "array-value"; key: string }
  | { type: "property" };

export interface YamlFieldEntry {
  end: number;
  key: string;
  start: number;
}

const topLevelYamlFieldPattern = /^([^#\s][^:]*):(?:\s|$)/;

export const frontmatterDialogRequestEvent = "relic-frontmatter-dialog-request";
export const frontmatterFieldNamePattern = /^[^#\s:][^\r\n:]*$/;
export const fixedFrontmatterFieldNames = ["aliases", "tags", "status", "chronicle", "plannedDate", "actualDate"];

export function findYamlInlineComment(line: string): string | null {
  let quote: "'" | "\"" | null = null;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const previous = index > 0 ? line[index - 1] : "";

    if (quote) {
      if (char === quote && previous !== "\\") quote = null;
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (char === "#" && (index === 0 || /\s/.test(previous))) {
      return line.slice(index).trimEnd();
    }
  }

  return null;
}

export function findYamlScalarQuote(line: string): "'" | "\"" | null {
  const match = /^[^:]+:\s*(["'])/.exec(line);
  if (!match) return null;

  return match[1] === "'" ? "'" : "\"";
}

export function isYamlFlowSequence(line: string): boolean {
  return /^[^:]+:\s*\[/.test(line);
}

export function isFixedDateRangeField(key: string): boolean {
  return key === "date" || key === "plannedDate" || key === "actualDate";
}

export function shouldSerializeArrayAsFlowSequence(key: string, field?: UserDefinedField): boolean {
  return isFixedDateRangeField(key) || key === "aliases" || key === "tags" || key === "chronicle" || Boolean(field);
}

export function isSingleValueField(field?: UserDefinedField): boolean {
  return Boolean(field && field.type !== "multi-select");
}

export function firstArrayValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export function isEditableScalar(value: unknown): boolean {
  return value === null || value === undefined || typeof value !== "object" || value instanceof Date;
}

export function findTopLevelYamlFieldEntries(lines: string[]): YamlFieldEntry[] {
  const entries: YamlFieldEntry[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = topLevelYamlFieldPattern.exec(lines[index]);
    if (!match) continue;

    let end = index + 1;
    while (end < lines.length && /^[ \t]/.test(lines[end])) end += 1;

    entries.push({ end, key: match[1].trim(), start: index });
  }

  return entries;
}

export function fieldFor(key: string, userDefinedFields: UserDefinedField[]): UserDefinedField | undefined {
  if (key === "aliases" || key === "tags") return { name: key, type: "multi-select" };
  if (key === "status") return { name: key, type: "select", choices: [...fixedStatusValues] };
  if (isFixedDateRangeField(key)) return { name: key, type: "date" };
  return userDefinedFields.find((field) => field.name === key);
}

export function choicesFor(
  key: string,
  field: UserDefinedField | undefined,
  candidates: Record<string, string[]>
): string[] {
  if (key === "aliases") return [];
  if (key === "status") return [...fixedStatusValues];
  return Array.from(new Set([...(field?.choices ?? []), ...(candidates[key] ?? [])]))
    .sort((a, b) => a.localeCompare(b));
}

export function availableFieldNames(
  data: Record<string, unknown>,
  userDefinedFields: UserDefinedField[],
  candidates: Record<string, string[]>
): string[] {
  const usedKeys = new Set(Object.keys(data));
  return Array.from(new Set([
    ...fixedFrontmatterFieldNames,
    ...userDefinedFields.map((field) => field.name),
    ...Object.keys(candidates)
  ]))
    .filter((key) => !usedKeys.has(key))
    .sort((a, b) => a.localeCompare(b));
}

export function inputTypeFor(field?: UserDefinedField): string {
  if (field?.type === "date") return "date";
  if (field?.type === "datetime") return "datetime-local";
  if (field?.type === "time") return "time";
  if (field?.type === "number") return "number";
  if (field?.type === "url") return "url";
  return "text";
}

export function scalarInputValue(value: unknown, field?: UserDefinedField): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (field?.type === "datetime") return value.toISOString().slice(0, 16);
    if (field?.type === "time") return value.toISOString().slice(11, 16);
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

export function parseScalarValue(value: string, field?: UserDefinedField): unknown {
  if (value === "") return undefined;
  if (field?.type === "number") {
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? value : numericValue;
  }
  return value;
}

export function parseChronicleYearInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const year = Number(trimmed);
  return Number.isInteger(year) && year !== 0 ? year : null;
}

export function chronicleInputValue(value: unknown): string {
  return typeof value === "number" && Number.isInteger(value) && value !== 0 ? String(value) : "";
}

export function parseDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed ? null : trimmed;
}

export function dateInputValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" && parseDateInput(value) !== null ? value : "";
}

export function serializeFlowScalar(key: string, value: unknown): string {
  if (isFixedDateRangeField(key) && typeof value === "string" && parseDateInput(value) !== null) return value;
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  return JSON.stringify(String(value));
}

export function serializeData(data: Record<string, unknown>, userDefinedFields: UserDefinedField[] = []): string {
  return Object.entries(data)
    .map(([key, value]) => {
      const field = fieldFor(key, userDefinedFields);
      if (value === "") return `${key}:`;
      if (Array.isArray(value) && shouldSerializeArrayAsFlowSequence(key, field)) {
        return `${key}: [${value.map((item) => serializeFlowScalar(key, item)).join(", ")}]`;
      }
      if (field?.type === "date" && typeof value === "string") return `${key}: ${value}`;
      return yaml.dump({ [key]: value }, { lineWidth: -1 }).trimEnd();
    })
    .join("\n");
}

export function serializeEntryPreservingQuote(
  entry: YamlFieldEntry,
  lines: string[],
  value: unknown,
  userDefinedFields: UserDefinedField[] = []
): string {
  const field = fieldFor(entry.key, userDefinedFields);

  if (
    Array.isArray(value) &&
    (
      shouldSerializeArrayAsFlowSequence(entry.key, field) ||
      (entry.end === entry.start + 1 && isYamlFlowSequence(lines[entry.start]))
    )
  ) {
    return `${entry.key}: [${value.map((item) => serializeFlowScalar(entry.key, item)).join(", ")}]`;
  }

  if (entry.end !== entry.start + 1 || typeof value !== "string" || value.includes("\n")) {
    return serializeData({ [entry.key]: value }, userDefinedFields);
  }

  const quote = findYamlScalarQuote(lines[entry.start]);
  if (!quote) return serializeData({ [entry.key]: value }, userDefinedFields);

  if (quote === "'") {
    return `${entry.key}: '${value.replaceAll("'", "''")}'`;
  }

  return `${entry.key}: ${JSON.stringify(value)}`;
}

export function serializeEntryPreservingInlineComment(
  entry: YamlFieldEntry,
  lines: string[],
  value: unknown,
  userDefinedFields: UserDefinedField[] = []
): string {
  const serialized = serializeEntryPreservingQuote(entry, lines, value, userDefinedFields);
  const comment = entry.end === entry.start + 1 ? findYamlInlineComment(lines[entry.start]) : null;

  if (!comment || serialized.includes("\n")) return serialized;

  return `${serialized} ${comment}`;
}

export function serializeDataPreservingYaml(
  block: FrontmatterBlock,
  data: Record<string, unknown>,
  userDefinedFields: UserDefinedField[] = []
): string {
  const keys = Object.keys(data);
  if (keys.length === 0) return "";

  const lines = block.yamlText.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();

  const entries = findTopLevelYamlFieldEntries(lines);
  if (entries.length === 0) {
    const preservedPrefix = lines.join("\n").trimEnd();
    const serialized = serializeData(data, userDefinedFields);
    return preservedPrefix ? `${preservedPrefix}\n${serialized}` : serialized;
  }

  const entryByStart = new Map(entries.map((entry) => [entry.start, entry]));
  const writtenKeys = new Set<string>();
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const entry = entryByStart.get(index);
    if (!entry) {
      output.push(lines[index]);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(data, entry.key)) {
      output.push(serializeEntryPreservingInlineComment(entry, lines, data[entry.key], userDefinedFields));
      writtenKeys.add(entry.key);
    }

    index = entry.end - 1;
  }

  for (const key of keys) {
    if (!writtenKeys.has(key)) output.push(serializeData({ [key]: data[key] }, userDefinedFields));
  }

  return output.join("\n");
}

export function findFrontmatterLineRange(doc: Text): { end: number; start: number } | null {
  if (doc.lines < 2 || doc.line(1).text.trim() !== "---") return null;

  for (let lineNumber = 2; lineNumber <= doc.lines; lineNumber += 1) {
    if (doc.line(lineNumber).text.trim() === "---") {
      return { end: lineNumber, start: 1 };
    }
  }

  return null;
}

export function findFrontmatterBlock(state: EditorState): FrontmatterBlock | null {
  const range = findFrontmatterLineRange(state.doc);
  if (!range) return null;

  const openLine = state.doc.line(range.start);
  const closeLine = state.doc.line(range.end);
  const yamlText = state.doc.sliceString(openLine.to + 1, closeLine.from);

  try {
    const parsed = yaml.load(yamlText);

    if (parsed === null || parsed === undefined) {
      return {
        bodyFrom: closeLine.to + 1,
        data: {},
        endLine: range.end,
        from: openLine.from,
        startLine: range.start,
        to: closeLine.to,
        yamlText
      };
    }
    if (typeof parsed !== "object" || Array.isArray(parsed)) return null;

    return {
      bodyFrom: closeLine.to + 1,
      data: parsed as Record<string, unknown>,
      endLine: range.end,
      from: openLine.from,
      startLine: range.start,
      to: closeLine.to,
      yamlText
    };
  } catch {
    return null;
  }
}

export function requestFrontmatterDialog(view: EditorView, detail: FrontmatterDialogRequest): void {
  view.dom.dispatchEvent(new CustomEvent<FrontmatterDialogRequest>(frontmatterDialogRequestEvent, {
    bubbles: true,
    detail
  }));
}
