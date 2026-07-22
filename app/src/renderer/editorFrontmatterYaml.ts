import { EditorState, type Text } from "@codemirror/state";
import * as yaml from "js-yaml";

import type { UserDefinedField } from "../shared/ipc";
import { fieldFor } from "./editorFrontmatterFields";
import { contentChangeRange, type EditorContentUpdate } from "./editorContentUpdate";

export interface FrontmatterBlock {
  bodyFrom: number;
  data: Record<string, unknown>;
  endLine: number;
  from: number;
  startLine: number;
  to: number;
  yamlText: string;
}

export interface YamlFieldEntry {
  end: number;
  key: string;
  start: number;
}

const topLevelYamlFieldPattern = /^([^#\s][^:]*):(?:\s|$)/;

function findYamlInlineComment(line: string): string | null {
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

function findYamlScalarQuote(line: string): "'" | "\"" | null {
  const match = /^[^:]+:\s*(["'])/.exec(line);
  if (!match) return null;

  return match[1] === "'" ? "'" : "\"";
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

export function reorderTopLevelYamlFields(yamlText: string, orderedKeys: string[]): string {
  const newline = yamlText.includes("\r\n") ? "\r\n" : "\n";
  const hasTrailingNewline = yamlText.endsWith(newline);
  const lines = yamlText.split(/\r?\n/);
  if (hasTrailingNewline) lines.pop();

  const entries = findTopLevelYamlFieldEntries(lines);
  const orderedKeySet = new Set(orderedKeys);
  if (orderedKeySet.size !== orderedKeys.length) return yamlText;

  const movableEntries = entries.filter((entry) => orderedKeySet.has(entry.key));
  if (
    movableEntries.length !== orderedKeys.length ||
    orderedKeys.some((key) => !movableEntries.some((entry) => entry.key === key))
  ) {
    return yamlText;
  }

  const entryByStart = new Map(entries.map((entry) => [entry.start, entry]));
  const movableBlocks = new Map(movableEntries.map((entry) => [entry.key, lines.slice(entry.start, entry.end)]));
  let movableIndex = 0;
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const entry = entryByStart.get(index);
    if (!entry) {
      output.push(lines[index]);
      continue;
    }

    if (orderedKeySet.has(entry.key)) {
      output.push(...(movableBlocks.get(orderedKeys[movableIndex]) ?? []));
      movableIndex += 1;
    } else {
      output.push(...lines.slice(entry.start, entry.end));
    }
    index = entry.end - 1;
  }

  const result = output.join(newline);
  return hasTrailingNewline ? `${result}${newline}` : result;
}

export function serializeData(data: Record<string, unknown>, userDefinedFields: UserDefinedField[] = []): string {
  return Object.entries(data)
    .map(([key, value]) => {
      const field = fieldFor(key, userDefinedFields);
      if (value === "") return `${key}:`;
      if (field?.type === "date" && typeof value === "string") return `${key}: ${value}`;
      return yaml.dump({ [key]: value }, { lineWidth: -1 }).trimEnd();
    })
    .join("\n");
}

function serializeEntryPreservingQuote(
  entry: YamlFieldEntry,
  lines: string[],
  value: unknown,
  userDefinedFields: UserDefinedField[] = []
): string {
  if (Array.isArray(value) || entry.key === "chronicle") return serializeData({ [entry.key]: value }, userDefinedFields);

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

function serializeEntryPreservingInlineComment(
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

export interface FrontmatterValidationSnapshot {
  content: string;
  invalid: boolean;
  revision: number;
  validationTo: number;
}

let frontmatterYamlParseCount = 0;

export function updateFrontmatterValidation(
  previous: FrontmatterValidationSnapshot | null,
  content: string,
  revision = 0,
  update?: EditorContentUpdate
): FrontmatterValidationSnapshot {
  if (previous?.content === content) return previous;
  if (previous) {
    const range = contentChangeRange(previous.content, previous.revision, content, revision, update);
    if (range && range.from >= previous.validationTo) return { ...previous, content, revision };
  }

  return parseFrontmatterValidation(content, revision);
}

export function hasInvalidFrontmatterYaml(content: string): boolean {
  return parseFrontmatterValidation(content, 0).invalid;
}

/** @internal Test-only counter for deterministic performance assertions. */
export function __getFrontmatterYamlParseCountForTests(): number {
  return frontmatterYamlParseCount;
}

/** @internal Test-only reset for deterministic performance assertions. */
export function __resetFrontmatterYamlParseCountForTests(): void {
  frontmatterYamlParseCount = 0;
}

function parseFrontmatterValidation(content: string, revision: number): FrontmatterValidationSnapshot {
  const firstNewline = content.indexOf("\n");
  const firstLineEnd = firstNewline === -1 ? content.length : firstNewline;
  const firstLineTo = firstNewline === -1 ? content.length : firstNewline + 1;
  if (content.slice(0, firstLineEnd).trim() !== "---") {
    return { content, invalid: false, revision, validationTo: firstLineTo };
  }

  let lineFrom = firstLineTo;
  while (lineFrom <= content.length) {
    const newline = content.indexOf("\n", lineFrom);
    const lineTo = newline === -1 ? content.length : newline;
    if (content.slice(lineFrom, lineTo).trim() === "---") {
      return {
        content,
        invalid: invalidYamlObject(content.slice(firstLineTo, lineFrom)),
        revision,
        validationTo: newline === -1 ? lineTo : newline + 1
      };
    }
    if (newline === -1) break;
    lineFrom = newline + 1;
  }

  return { content, invalid: true, revision, validationTo: content.length };
}

function invalidYamlObject(yamlText: string): boolean {
  if (yamlText.trim() === "") return false;
  frontmatterYamlParseCount += 1;
  try {
    const parsed = yaml.load(yamlText);
    return parsed !== null && parsed !== undefined && (typeof parsed !== "object" || Array.isArray(parsed));
  } catch {
    return true;
  }
}

export function findFrontmatterBlock(state: EditorState): FrontmatterBlock | null {
  const range = findFrontmatterLineRange(state.doc);
  if (!range) return null;

  const openLine = state.doc.line(range.start);
  const closeLine = state.doc.line(range.end);
  const yamlText = state.doc.sliceString(openLine.to + 1, closeLine.from);

  if (yamlText.trim() === "") {
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
