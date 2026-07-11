import { EditorView } from "@codemirror/view";

import { reservedFrontmatterFieldNames } from "../shared/frontmatterFields";
import type { FrontmatterDateFormat, UserDefinedField } from "../shared/ipc";

export type FrontmatterDialogRequest =
  | { type: "array-value"; key: string }
  | { type: "property" };

export interface FrontmatterPropertyMenuRequest {
  anchor: HTMLElement;
}

export const frontmatterDialogRequestEvent = "relic-frontmatter-dialog-request";
export const frontmatterPropertyMenuRequestEvent = "relic-frontmatter-property-menu-request";
export const frontmatterFieldNamePattern = /^[^#\s:][^\r\n:]*$/;
export const fixedFrontmatterFieldNames = reservedFrontmatterFieldNames;

export function shouldSerializeArrayAsFlowSequence(key: string, field?: UserDefinedField): boolean {
  void key;
  void field;
  return false;
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

export function fieldFor(key: string, userDefinedFields: UserDefinedField[]): UserDefinedField | undefined {
  if (key === "category") return { name: key, type: "select" };
  if (key === "aliases" || key === "tags") return { name: key, type: "multi-select" };
  return userDefinedFields.find((field) => field.name === key);
}

export function isChronicleField(key: string): key is "chronicle" {
  return key === "chronicle";
}

export function choicesFor(
  key: string,
  field: UserDefinedField | undefined,
  candidates: Record<string, string[]>
): string[] {
  if (key === "aliases") return [];
  return Array.from(new Set([...(field?.choices ?? []), ...(candidates[key] ?? [])]))
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

export function parseChronicleYearInput(value: string, allowZeroOrNegative = false): number | null {
  const trimmed = value.trim();
  if (!(allowZeroOrNegative ? /^-?\d+$/.test(trimmed) : /^\d+$/.test(trimmed))) return null;
  const year = Number(trimmed);
  return Number.isInteger(year) && (allowZeroOrNegative || year >= 1) ? year : null;
}

export function chronicleInputValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : "";
  if (typeof value === "string") return value;
  const legacyYear = legacyChronicleYear(value);
  if (legacyYear !== null) return String(legacyYear);
  return "";
}

export function legacyChronicleYear(value: unknown): number | null {
  if (!Array.isArray(value)) return null;
  const firstEntry = value[0];
  if (!Array.isArray(firstEntry) || !Array.isArray(firstEntry[1])) return null;
  const start = firstEntry[1][0];
  if (!Array.isArray(start) || !Number.isInteger(start[0]) || start[0] === 0) return null;
  return Number(start[0]);
}

export function chronicleYearRangeInput(value: unknown): { end: string; start: string } {
  if (typeof value === "number" && Number.isInteger(value) && value !== 0) {
    return { end: "", start: String(value) };
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const range = value as Record<string, unknown>;
    const start = Number.isInteger(range.start) && range.start !== 0 ? String(range.start) : "";
    const end = Number.isInteger(range.end) && range.end !== 0 ? String(range.end) : "";
    return { end, start };
  }
  const legacyStart = legacyChronicleYear(value);
  if (legacyStart === null) return { end: "", start: "" };
  const legacyEntry = Array.isArray(value) ? value[0] : null;
  const legacyEnd = Array.isArray(legacyEntry) && Array.isArray(legacyEntry[1]) && Array.isArray(legacyEntry[1][1]) && Number.isInteger(legacyEntry[1][1][0])
    ? Number(legacyEntry[1][1][0])
    : legacyStart;
  return { end: legacyEnd === legacyStart ? "" : String(legacyEnd), start: String(legacyStart) };
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

export function formatDateForInput(value: string, format: FrontmatterDateFormat): string {
  const normalized = parseDateInput(value);
  if (normalized === null) return "";
  if (format === "mdy") return `${normalized.slice(5, 7)}/${normalized.slice(8, 10)}/${normalized.slice(0, 4)}`;
  if (format === "dmy") return `${normalized.slice(8, 10)}/${normalized.slice(5, 7)}/${normalized.slice(0, 4)}`;
  return normalized;
}

export function parseDateInputForFormat(value: string, format: FrontmatterDateFormat): string | null {
  const trimmed = value.trim();
  const isoValue = parseDateInput(trimmed);
  if (isoValue !== null) return isoValue;
  if (format === "system" || format === "ymd") return null;

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;

  const [, first, second, year] = match;
  const month = format === "mdy" ? first : second;
  const day = format === "mdy" ? second : first;
  return parseDateInput(`${year}-${month}-${day}`);
}

export function inputPlaceholderForDateFormat(format: FrontmatterDateFormat): string {
  if (format === "mdy") return "MM/DD/YYYY";
  if (format === "dmy") return "DD/MM/YYYY";
  return "YYYY-MM-DD";
}

export function requestFrontmatterDialog(view: EditorView, detail: FrontmatterDialogRequest): void {
  view.dom.dispatchEvent(new CustomEvent<FrontmatterDialogRequest>(frontmatterDialogRequestEvent, {
    bubbles: true,
    detail
  }));
}

export function requestFrontmatterPropertyMenu(anchor: HTMLElement): void {
  anchor.dispatchEvent(new CustomEvent<FrontmatterPropertyMenuRequest>(frontmatterPropertyMenuRequestEvent, {
    bubbles: true,
    detail: { anchor }
  }));
}
