export interface GenerateTitleListInput {
  filterFolder?: string;
  filterTag?: string;
  outputFolder: string;
  outputName: string;
  sortBy: "name" | "mtime";
}

export interface GenerateTableOfContentsInput {
  includeSubfolders: boolean;
  outputFolder: string;
  outputName: string;
  targetFolder: string;
}

export type MergeFilterType = "folder" | "frontmatter" | "tag" | "all";
export type MergeSortBy = "name" | "mtime" | "ctime";

export interface MergeFilesInput {
  frontmatterField?: string;
  filterType: MergeFilterType;
  filterValue: string;
  insertFilenameHeading: boolean;
  outputFolder: string;
  outputName: string;
  sortBy: MergeSortBy;
}

export type SplitHeadingLevel = 1 | 2 | 3;

export interface SplitFileByHeadingInput {
  headingLevel: SplitHeadingLevel;
  outputFolder: string;
  sourcePath: string;
}
