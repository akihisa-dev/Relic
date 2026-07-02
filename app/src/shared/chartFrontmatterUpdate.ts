import * as yaml from "js-yaml";

import { monthAxisToPoint } from "./chartTime";
import {
  defaultChronicleCalendars,
  type ChronicleCalendarSettings,
  type UpdateChartEntryInput
} from "./ipcCharts";
import { fail, ok, type RelicResult } from "./result";

interface FrontmatterBlock {
  body: string;
  close: string;
  open: string;
  yaml: string;
}

export function updateChartFrontmatterContent(
  content: string,
  input: UpdateChartEntryInput,
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars
): RelicResult<string> {
  const frontmatter = splitFrontmatterBlock(content);

  if (!frontmatter) {
    return fail(
      "CHART_FRONTMATTER_MISSING",
      "チャート対象のフロントマターが見つからないため、変更を保存できませんでした。"
    );
  }

  const data = parseYamlObject(frontmatter.yaml);
  if (!data.ok) return data;

  const nextData = chartFrontmatterUpdates(data.value, input, calendars);
  if (!nextData.ok) return nextData;

  const nextYaml = setYamlField(frontmatter.yaml, "chronicle", nextData.value.chronicle);

  return ok(`${frontmatter.open}${nextYaml}${frontmatter.close}${frontmatter.body}`);
}

export function splitFrontmatterBlock(content: string): FrontmatterBlock | null {
  const open = /^---\r?\n/.exec(content);

  if (!open) return null;

  const rest = content.slice(open[0].length);
  const close = /^---(?:\r?\n|$)/m.exec(rest);

  if (!close || close.index === undefined) return null;

  return {
    body: rest.slice(close.index + close[0].length),
    close: close[0],
    open: open[0],
    yaml: rest.slice(0, close.index)
  };
}

function parseYamlObject(yamlText: string): RelicResult<Record<string, unknown>> {
  try {
    const parsed = yaml.load(yamlText);

    if (parsed === null || parsed === undefined) return ok({});
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return fail(
        "CHART_FRONTMATTER_INVALID",
        "フロントマターが正しいYAMLオブジェクトではないため、チャートの変更を保存できませんでした。"
      );
    }

    return ok(parsed as Record<string, unknown>);
  } catch (error) {
    return fail(
      "CHART_FRONTMATTER_INVALID",
      "フロントマターが壊れているため、チャートの変更を保存できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function chartFrontmatterUpdates(
  data: Record<string, unknown>,
  input: UpdateChartEntryInput,
  calendars: ChronicleCalendarSettings[]
): RelicResult<Record<string, unknown>> {
  const start = Math.min(input.startValue, input.endValue);
  const end = Math.max(input.startValue, input.endValue);
  const chronicle = Array.isArray(data.chronicle) ? [...data.chronicle] : [];
  const currentEntry = chronicle[input.chronicleEntryIndex];

  if (!Array.isArray(currentEntry) || typeof currentEntry[0] !== "string") {
    return fail(
      "CHART_CHRONICLE_ENTRY_MISSING",
      "対象の年表項目が見つからないため、チャートの変更を保存できませんでした。"
    );
  }

  const calendarName = currentEntry[0].trim();
  const calendar = calendars.find((item) => item.name.trim() === calendarName);
  if (!calendar) {
    return fail(
      "CHART_CHRONICLE_CALENDAR_MISSING",
      "対象の暦設定が見つからないため、チャートの変更を保存できませんでした。"
    );
  }

  const startPoint = monthAxisToPoint(start);
  const endPoint = monthAxisToPoint(end);
  const startYear = mainYearToCalendarYear(calendar, startPoint.year);
  const endYear = mainYearToCalendarYear(calendar, endPoint.year);

  chronicle[input.chronicleEntryIndex] = [
    calendarName,
    [
      [startYear, startPoint.month],
      [endYear, endPoint.month]
    ]
  ];

  return ok({ ...data, chronicle });
}

function setYamlField(yamlText: string, field: string, value: unknown): string {
  const dumped = yaml.dump({ [field]: value }, { flowLevel: 2, lineWidth: -1, quoteStyle: "double", forceQuotes: false });
  const replacement = dumped.endsWith("\n") ? dumped : `${dumped}\n`;
  const range = findTopLevelFieldRange(yamlText, field);

  if (!range) {
    return `${yamlText}${yamlText.endsWith("\n") || yamlText.length === 0 ? "" : "\n"}${replacement}`;
  }

  return `${yamlText.slice(0, range.from)}${replacement}${yamlText.slice(range.to)}`;
}

function findTopLevelFieldRange(
  yamlText: string,
  field: string
): { from: number; lineEnd: number; to: number } | null {
  const pattern = new RegExp(`(^|\\n)${escapeRegExp(field)}\\s*:`);
  const match = pattern.exec(yamlText);

  if (!match || match.index === undefined) return null;

  const from = match.index + (match[1] === "\n" ? 1 : 0);
  const lineEnd = nextLineEnd(yamlText, from);
  let to = lineEnd;

  while (to < yamlText.length) {
    const candidateEnd = nextLineEnd(yamlText, to);
    const line = yamlText.slice(to, candidateEnd);

    if (!/^[ \t]/.test(line)) break;

    to = candidateEnd;
  }

  return { from, lineEnd, to };
}

function nextLineEnd(text: string, from: number): number {
  const nextNewline = text.indexOf("\n", from);
  return nextNewline === -1 ? text.length : nextNewline + 1;
}

function mainYearToCalendarYear(calendar: { startYear?: number }, mainYear: number): number {
  return mainYear - (calendar.startYear ?? 1) + 1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
