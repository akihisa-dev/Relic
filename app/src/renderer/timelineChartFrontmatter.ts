import type { UpdateTimelineChartEntryInput } from "../shared/ipc";
import { axisToYear, rangeToStringArray } from "../shared/chartTime";

export function updateTimelineFrontmatter(content: string, input: UpdateTimelineChartEntryInput): string {
  const frontmatter = splitFrontmatterBlock(content);
  const yamlText = frontmatter?.yaml ?? "";
  const updates = timelineFrontmatterUpdates(yamlText, input);
  const nextYaml = Object.entries(updates).reduce(
    (yaml, [field, values]) => setYamlArrayField(yaml, field, values),
    yamlText
  );

  if (frontmatter) {
    return `${frontmatter.open}${nextYaml}${frontmatter.close}${frontmatter.body}`;
  }

  return `---\n${nextYaml}---\n${content}`;
}

export function splitFrontmatterBlock(content: string): { body: string; close: string; open: string; yaml: string } | null {
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

export function readYamlArrayField(yamlText: string, field: string): string[] {
  const pattern = new RegExp(`^${escapeRegExp(field)}\\s*:\\s*\\[([^\\]]*)\\]`, "m");
  const match = pattern.exec(yamlText);

  if (!match) return [];

  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function timelineFrontmatterUpdates(yamlText: string, input: UpdateTimelineChartEntryInput): Record<string, string[]> {
  void yamlText;
  const start = Math.min(input.startValue, input.endValue);
  const end = Math.max(input.startValue, input.endValue);
  const startYear = axisToYear(start);
  const endYear = axisToYear(end);

  return {
    timeline: rangeToStringArray(startYear, endYear)
  };
}

function setYamlArrayField(yamlText: string, field: string, values: string[]): string {
  const line = `${field}: [${values.join(", ")}]\n`;
  const pattern = new RegExp(`^${escapeRegExp(field)}\\s*:.*(?:\\r?\\n|$)`, "m");

  if (pattern.test(yamlText)) {
    return yamlText.replace(pattern, line);
  }

  return `${yamlText}${yamlText.endsWith("\n") || yamlText.length === 0 ? "" : "\n"}${line}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
