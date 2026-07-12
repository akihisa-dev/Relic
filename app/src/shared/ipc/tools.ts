import type { RelicResult } from "../result";
import type { IpcFeatureContract } from "./contract";

export const generateTitleListChannel = "tools:generateTitleList";
export const generateTableOfContentsChannel = "tools:generateTableOfContents";
export const generateTagIndexChannel = "tools:generateTagIndex";
export const mergeFilesChannel = "tools:mergeFiles";

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

export interface GenerateTagIndexInput {
  includeSubfolders: boolean;
  includeUntagged: boolean;
  outputFolder: string;
  outputName: string;
  sortBy: "name" | "mtime";
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

export interface ToolsApi {
  generateTitleList: (input: GenerateTitleListInput) => Promise<RelicResult<string>>;
  generateTableOfContents: (input: GenerateTableOfContentsInput) => Promise<RelicResult<string>>;
  generateTagIndex: (input: GenerateTagIndexInput) => Promise<RelicResult<string>>;
  mergeFiles: (input: MergeFilesInput) => Promise<RelicResult<string>>;
}

export const toolsIpcContract = {
  generateTitleList: { channel: generateTitleListChannel, main: "handle", transport: "invoke", validatesInput: true },
  generateTableOfContents: { channel: generateTableOfContentsChannel, main: "handle", transport: "invoke", validatesInput: true },
  generateTagIndex: { channel: generateTagIndexChannel, main: "handle", transport: "invoke", validatesInput: true },
  mergeFiles: { channel: mergeFilesChannel, main: "handle", transport: "invoke", validatesInput: true }
} as const satisfies IpcFeatureContract;
