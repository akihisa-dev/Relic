import type { UpdateGanttChartEntryInput } from "../shared/ipc";
import { axisToYear, dayToDate, isDateString, rangeToStringArray, shiftDateYears } from "../shared/chartTime";

export function updateChartFrontmatter(content: string, input: UpdateGanttChartEntryInput): string {
  const frontmatter = splitFrontmatterBlock(content);
  const yamlText = frontmatter?.yaml ?? "";
  const updates = chartFrontmatterUpdates(yamlText, input);
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

function chartFrontmatterUpdates(yamlText: string, input: UpdateGanttChartEntryInput): Record<string, string[]> {
  const start = Math.min(input.startValue, input.endValue);
  const end = Math.max(input.startValue, input.endValue);

  if (input.source === "date") {
    const startDate = dayToDate(start);
    const endDate = dayToDate(end);
    const dateField = input.dateKind === "actual" ? "actualDate" : "plannedDate";
    const updates: Record<string, string[]> = {
      chronicle: rangeToStringArray(dateYear(startDate), dateYear(endDate)),
      [dateField]: rangeToStringArray(startDate, endDate)
    };

    return updates;
  }

  const originalPlannedDate = readYamlArrayField(yamlText, "plannedDate");
  const originalActualDate = readYamlArrayField(yamlText, "actualDate");
  const originalStartYear = axisToYear(input.originalStartValue);
  const originalEndYear = axisToYear(input.originalEndValue);
  const startYear = axisToYear(start);
  const endYear = axisToYear(end);
  const updates: Record<string, string[]> = {
    chronicle: rangeToStringArray(startYear, endYear)
  };

  const shiftDateRange = (values: string[]): string[] | null => {
    if (values.length !== 1 && values.length !== 2) return null;

    const startDate = values[0];
    const endDate = values[1] ?? startDate;

    if (isDateString(startDate) && isDateString(endDate)) {
      return rangeToStringArray(
        shiftDateYears(startDate, startYear - originalStartYear),
        shiftDateYears(endDate, endYear - originalEndYear)
      );
    }

    return null;
  };

  const plannedDate = shiftDateRange(originalPlannedDate);
  const actualDate = shiftDateRange(originalActualDate);

  if (plannedDate) updates.plannedDate = plannedDate;
  if (actualDate) updates.actualDate = actualDate;

  return updates;
}

function setYamlArrayField(yamlText: string, field: string, values: string[]): string {
  const line = `${field}: [${values.join(", ")}]\n`;
  const pattern = new RegExp(`^${escapeRegExp(field)}\\s*:.*(?:\\r?\\n|$)`, "m");

  if (pattern.test(yamlText)) {
    return yamlText.replace(pattern, line);
  }

  return `${yamlText}${yamlText.endsWith("\n") || yamlText.length === 0 ? "" : "\n"}${line}`;
}

function dateYear(value: string): number {
  return Number(value.slice(0, 4));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
