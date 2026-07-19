import type { ChartEntry } from "../shared/ipc";

export const CHRONICLE_UNCATEGORIZED_KEY = "uncategorized";
const CHRONICLE_CATEGORY_HUE_COUNT = 360;
const CHRONICLE_CATEGORY_HUE_STEP = 137;

export interface ChronicleCategoryOption {
  count: number;
  hue: number | null;
  key: string;
  label: string;
}

export function chronicleCategoryKey(category: string | undefined): string {
  const normalized = category?.trim();
  return normalized ? `category:${normalized}` : CHRONICLE_UNCATEGORIZED_KEY;
}

export function createChronicleCategoryOptions(
  entries: ChartEntry[],
  categoryChoices: string[],
  uncategorizedLabel: string
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
  const options: ChronicleCategoryOption[] = [...counts.entries()].map(([key, value]) => ({
    count: value.count,
    hue: null,
    key,
    label: value.label
  }));

  const sortedOptions = options.toSorted((left, right) => {
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
  assignDistinctCategoryHues(sortedOptions);
  return sortedOptions;
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

function assignDistinctCategoryHues(options: ChronicleCategoryOption[]): void {
  const usedSlots = new Set<number>();
  const categorizedOptions = options
    .filter((option) => option.key !== CHRONICLE_UNCATEGORIZED_KEY)
    .toSorted((left, right) => left.key.localeCompare(right.key, "ja"));

  for (const option of categorizedOptions) {
    let slot = hashCategory(option.key) % CHRONICLE_CATEGORY_HUE_COUNT;
    while (usedSlots.has(slot) && usedSlots.size < CHRONICLE_CATEGORY_HUE_COUNT) {
      slot = (slot + 1) % CHRONICLE_CATEGORY_HUE_COUNT;
    }
    usedSlots.add(slot);
    option.hue = (slot * CHRONICLE_CATEGORY_HUE_STEP) % CHRONICLE_CATEGORY_HUE_COUNT;
  }
}

function hashCategory(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
