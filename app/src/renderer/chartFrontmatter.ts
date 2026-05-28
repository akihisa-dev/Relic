import type { UpdateChartEntryInput } from "../shared/ipc";
import { updateChartFrontmatterContent, splitFrontmatterBlock } from "../shared/chartFrontmatterUpdate";

export function updateChartFrontmatter(content: string, input: UpdateChartEntryInput): string {
  const result = updateChartFrontmatterContent(content, input);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export function readYamlArrayField(yamlText: string, field: string): string[] {
  const pattern = new RegExp(`^${escapeRegExp(field)}\\s*:\\s*\\[([^\\]]*)\\]`, "m");
  const match = pattern.exec(yamlText);

  if (!match) return [];

  return match[1].split(",").flatMap((value) => {
    const item = value.trim().replace(/^['"]|['"]$/g, "");
    return item ? [item] : [];
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { splitFrontmatterBlock };
