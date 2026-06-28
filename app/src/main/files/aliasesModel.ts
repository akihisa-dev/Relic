const maxAliasLength = 256;
const maxAliasesPerFile = 64;

export function extractAliasesFromFrontmatterData(data: Record<string, unknown>): string[] {
  const value = data.aliases;

  if (Array.isArray(value)) {
    return uniqueAliases(value);
  }

  if (typeof value === "string") {
    return uniqueAliases([value]);
  }

  return [];
}

function uniqueAliases(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (result.length >= maxAliasesPerFile) break;
    if (typeof value !== "string") continue;

    const alias = value.trim();
    const key = alias.toLocaleLowerCase();
    if (!alias || alias.length > maxAliasLength || seen.has(key)) continue;
    seen.add(key);
    result.push(alias);
  }

  return result;
}
