import type { ChartEntry } from "../shared/ipc";

export const CHRONICLE_UNCATEGORIZED_KEY = "uncategorized";
export const CHRONICLE_CATEGORY_PALETTE_SIZE = 8;

export interface ChronicleCategoryOption {
  count: number;
  key: string;
  label: string;
  paletteIndex: number | null;
}

export function chronicleCategoryKey(category: string | undefined): string {
  const normalized = category?.trim();
  return normalized ? `category:${normalized}` : CHRONICLE_UNCATEGORIZED_KEY;
}

export function chronicleCategoryPaletteIndex(category: string | undefined, paletteLength: number): number | null {
  const normalized = category?.trim();
  if (!normalized || paletteLength <= 0) return null;

  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % paletteLength;
}

export function createChronicleCategoryOptions(
  entries: ChartEntry[],
  categoryChoices: string[],
  uncategorizedLabel: string,
  paletteLength: number
): ChronicleCategoryOption[] {
  const counts = new Map<string, { count: number; label: string }>();
  for (const entry of entries) {
    const label = entry.category?.trim() || uncategorizedLabel;
    const key = chronicleCategoryKey(entry.category);
    const current = counts.get(key);
    counts.set(key, { count: (current?.count ?? 0) + 1, label });
  }

  const choices = uniqueNormalizedValues(categoryChoices);
  const choiceOrder = new Map(choices.map((choice, index) => [chronicleCategoryKey(choice), index]));
  const options = [...counts.entries()].map(([key, value]) => ({
    count: value.count,
    key,
    label: value.label,
    paletteIndex: key === CHRONICLE_UNCATEGORIZED_KEY
      ? null
      : chronicleCategoryPaletteIndex(value.label, paletteLength)
  }));

  return options.toSorted((left, right) => {
    if (left.key === CHRONICLE_UNCATEGORIZED_KEY) return 1;
    if (right.key === CHRONICLE_UNCATEGORIZED_KEY) return -1;
    const leftOrder = choiceOrder.get(left.key);
    const rightOrder = choiceOrder.get(right.key);
    if (leftOrder !== undefined || rightOrder !== undefined) {
      if (leftOrder === undefined) return 1;
      if (rightOrder === undefined) return -1;
      return leftOrder - rightOrder;
    }
    return left.label.localeCompare(right.label, "ja");
  });
}

export function isChronicleEntryVisible(entry: ChartEntry, hiddenCategoryKeys: ReadonlySet<string>): boolean {
  return !hiddenCategoryKeys.has(chronicleCategoryKey(entry.category));
}

export function pruneChronicleHiddenCategoryKeys(
  hiddenCategoryKeys: Iterable<string>,
  options: ChronicleCategoryOption[]
): string[] {
  const availableKeys = new Set(options.map((option) => option.key));
  return [...hiddenCategoryKeys].filter((key) => availableKeys.has(key));
}

function uniqueNormalizedValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}
