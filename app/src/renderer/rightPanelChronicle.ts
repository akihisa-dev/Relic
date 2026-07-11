import * as yaml from "js-yaml";

import type { ChartEntry, ChroniclePoint } from "../shared/ipc";
import { pointToMonthAxis } from "../shared/chartTime";
import { splitFrontmatterBlock } from "./chartFrontmatter";

export interface RightPanelChronicleEntry {
  endLabel: string;
  endValue: number;
  fileName: string;
  path: string;
  startLabel: string;
  startValue: number;
}

export function rightPanelChronicleEntries(
  entries: ChartEntry[],
  activeFile: { content: string; name: string; path: string } | null
): RightPanelChronicleEntry[] {
  const saved = entries
    .filter((entry) => entry.path !== activeFile?.path)
    .map(({ endLabel, endValue, fileName, path, startLabel, startValue }) => ({
      endLabel: stripCalendarName(endLabel),
      endValue,
      fileName,
      path,
      startLabel: stripCalendarName(startLabel),
      startValue
    }));
  const active = activeFile ? chronicleEntriesFromMarkdown(activeFile) : [];

  return [...saved, ...active].toSorted((a, b) =>
    a.startValue - b.startValue ||
    a.endValue - b.endValue ||
    a.fileName.localeCompare(b.fileName, "ja")
  );
}

function chronicleEntriesFromMarkdown(file: { content: string; name: string; path: string }): RightPanelChronicleEntry[] {
  const frontmatter = splitFrontmatterBlock(file.content);
  if (!frontmatter) return [];

  let data: unknown;
  try {
    data = yaml.load(frontmatter.yaml);
  } catch {
    return [];
  }
  if (!isRecord(data)) return [];

  const simpleRange = parseSimpleChronicleRange(data.chronicle);
  if (simpleRange) return [entryForRange(file, simpleRange)];
  if (!Array.isArray(data.chronicle)) return [];

  return data.chronicle.flatMap((value): RightPanelChronicleEntry[] => {
    const range = parseChronicleRange(value);
    if (!range) return [];
    const [start, end] = range;
    return [entryForRange(file, { start, end })];
  });
}

function entryForRange(
  file: { name: string; path: string },
  range: { end: ChroniclePoint; start: ChroniclePoint }
): RightPanelChronicleEntry {
  return {
    endLabel: formatPoint(range.end),
    endValue: pointToMonthAxis(range.end.year, range.end.month),
    fileName: file.name.replace(/\.md$/i, ""),
    path: file.path,
    startLabel: formatPoint(range.start),
    startValue: pointToMonthAxis(range.start.year, range.start.month)
  };
}

function parseSimpleChronicleRange(value: unknown): { end: ChroniclePoint; start: ChroniclePoint } | null {
  if (Number.isInteger(value) && value !== 0) {
    const point = { month: null, year: Number(value) };
    return { end: point, start: point };
  }
  if (!isRecord(value) || !Number.isInteger(value.start) || value.start === 0) return null;
  const end = value.end === undefined ? value.start : value.end;
  if (!Number.isInteger(end) || end === 0 || Number(value.start) > Number(end)) return null;
  return {
    end: { month: null, year: Number(end) },
    start: { month: null, year: Number(value.start) }
  };
}

function parseChronicleRange(value: unknown): [ChroniclePoint, ChroniclePoint] | null {
  if (!Array.isArray(value) || value.length !== 2 || !Array.isArray(value[1]) || value[1].length !== 2) return null;
  const start = parsePoint(value[1][0]);
  const end = parsePoint(value[1][1]);
  if (!start || !end) return null;
  if (pointToMonthAxis(start.year, start.month) > pointToMonthAxis(end.year, end.month)) return null;
  return [start, end];
}

function parsePoint(value: unknown): ChroniclePoint | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [year, month] = value;
  if (!Number.isInteger(year) || year === 0) return null;
  if (month !== null && (!Number.isInteger(month) || Number(month) < 1 || Number(month) > 12)) return null;
  return { month: month === null ? null : Number(month), year: Number(year) };
}

function formatPoint(point: ChroniclePoint): string {
  const year = point.year < 0 ? `−${Math.abs(point.year)}` : String(point.year);
  return point.month === null ? year : `${year}-${String(point.month).padStart(2, "0")}`;
}

function stripCalendarName(label: string): string {
  const separator = label.lastIndexOf(" ");
  return separator >= 0 ? label.slice(separator + 1) : label;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
