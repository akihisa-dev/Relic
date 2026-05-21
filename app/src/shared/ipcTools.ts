export interface GenerateTitleListInput {
  filterCardFolder?: string;
  filterTag?: string;
  outputCardFolder: string;
  outputName: string;
  sortBy: "name" | "mtime";
}

export interface GenerateTableOfContentsInput {
  includeSubcardFolders: boolean;
  outputCardFolder: string;
  outputName: string;
  targetCardFolder: string;
}

export type MergeFilterType = "cardFolder" | "frontmatter" | "tag" | "all";
export type MergeSortBy = "name" | "mtime" | "ctime";

export interface MergeCardsInput {
  frontmatterField?: string;
  filterType: MergeFilterType;
  filterValue: string;
  insertCardNameHeading: boolean;
  outputCardFolder: string;
  outputName: string;
  sortBy: MergeSortBy;
}

export type SplitHeadingLevel = 1 | 2 | 3;

export interface SplitCardByHeadingInput {
  headingLevel: SplitHeadingLevel;
  outputCardFolder: string;
  sourcePath: string;
}
