import type { Translator } from "./i18nModel";
import { fixedFrontmatterFieldNames } from "./editorFrontmatter";

const basicFixedFieldNames = ["aliases", "category", "tags"] as const;
const chronicleFixedFieldNames = ["chronicle"] as const;

export interface FrontmatterPropertyMenuGroup {
  id: string;
  label: string;
  options: FrontmatterPropertyMenuOption[];
}

export interface FrontmatterPropertyMenuOption {
  key: string;
  label: string;
}

export interface FrontmatterPropertyMenuState {
  groups: FrontmatterPropertyMenuGroup[];
  unavailable: boolean;
}

export function buildFrontmatterPropertyMenuState(
  canAddProperty: boolean,
  usedKeys: Iterable<string>,
  t: Translator
): FrontmatterPropertyMenuState {
  if (!canAddProperty) {
    return { groups: [], unavailable: true };
  }

  const usedKeySet = new Set(usedKeys);
  const availableKeys = new Set(fixedFrontmatterFieldNames.filter((key) => !usedKeySet.has(key)));
  const groups = [
    frontmatterPropertyGroup(
      "basic",
      t("frontmatter.propertyGroupBasic"),
      basicFixedFieldNames.filter((key) => availableKeys.has(key)),
      t
    ),
    frontmatterPropertyGroup(
      "chronicle",
      t("frontmatter.propertyGroupChronicle"),
      chronicleFixedFieldNames.filter((key) => availableKeys.has(key)),
      t
    )
  ].filter((group) => group.options.length > 0);

  return { groups, unavailable: false };
}

function frontmatterPropertyGroup(
  id: string,
  label: string,
  keys: readonly string[],
  t: Translator
): FrontmatterPropertyMenuGroup {
  return {
    id,
    label,
    options: keys.map((key) => ({ key, label: frontmatterPropertyLabel(key, t) }))
  };
}

function frontmatterPropertyLabel(key: string, t: Translator): string {
  if (key === "aliases") return t("frontmatter.propertyAliases");
  if (key === "category") return "category";
  if (key === "tags") return t("frontmatter.propertyTags");
  if (key === "chronicle") return "chronicle";
  return key;
}
