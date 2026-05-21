import type { SearchMode, UserDefinedField } from "../shared/ipc";
import type { Translator } from "./i18n";

const fixedFrontmatterSearchFields = [
  "tags",
  "aliases",
  "status",
  "timeline"
];

export interface CardSearchModeOption {
  label: string;
  mode: SearchMode;
}

export function knownFrontmatterSearchFields(userDefinedFields: UserDefinedField[]): string[] {
  return Array.from(
    new Set([
      ...fixedFrontmatterSearchFields,
      ...userDefinedFields.map((field) => field.name)
    ])
  ).sort((a, b) => a.localeCompare(b, "ja"));
}

export function frontmatterValueCandidatesForField(
  candidates: Record<string, string[]>,
  field: string
): string[] {
  return field ? (candidates[field] ?? []) : [];
}

export function isFilteringCards({
  isSearching,
  query,
  searchError
}: {
  isSearching: boolean;
  query: string;
  searchError: string | null;
}): boolean {
  return query.trim() !== "" || isSearching || searchError !== null;
}

export function cardSearchModeOptions(t: Translator): CardSearchModeOption[] {
  return [
    { label: t("cards.searchModeFullText"), mode: "fullText" },
    { label: t("cards.searchModeCardName"), mode: "cardName" },
    { label: t("cards.searchModeTag"), mode: "tag" },
    { label: t("cards.searchModeFrontmatter"), mode: "frontmatter" },
    { label: t("cards.searchModeRegex"), mode: "regex" }
  ];
}

export function activeCardSearchModeLabel(
  options: CardSearchModeOption[],
  mode: SearchMode,
  fallback: string
): string {
  return options.find((option) => option.mode === mode)?.label ?? fallback;
}
