import * as yaml from "js-yaml";

import { monthAxisToYear } from "./chartTime";
import type { UpdateChartEntryInput } from "./ipc/workspace";
import { fail, ok, type RelicResult } from "./result";

interface FrontmatterBlock {
  body: string;
  close: string;
  open: string;
  yaml: string;
}

export function updateChartFrontmatterContent(
  content: string,
  input: UpdateChartEntryInput
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

  const nextData = chartFrontmatterUpdates(data.value, input);
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
  input: UpdateChartEntryInput
): RelicResult<Record<string, unknown>> {
  if (input.chronicleEntryIndex !== 0 || !isCurrentChronicleValue(data.chronicle)) {
    return fail(
      "CHART_CHRONICLE_ENTRY_MISSING",
      "対象の年表項目が見つからないため、チャートの変更を保存できませんでした。"
    );
  }

  const start = monthAxisToYear(Math.min(input.startValue, input.endValue));
  const end = monthAxisToYear(Math.max(input.startValue, input.endValue));
  return ok({ ...data, chronicle: start === end ? start : { end, start } });
}

function isCurrentChronicleValue(value: unknown): boolean {
  if (Number.isInteger(value) && value !== 0) return true;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const range = value as Record<string, unknown>;
  if (!Number.isInteger(range.start) || range.start === 0) return false;
  const end = range.end === undefined ? range.start : range.end;
  return Number.isInteger(end) && end !== 0 && Number(range.start) <= Number(end);
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
