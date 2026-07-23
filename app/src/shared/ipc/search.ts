import type { AliasIndex } from "../links";
import type { RelicResult } from "../result";
import type { IpcFeatureContract } from "./contract";

export const getBacklinksChannel = "workspace:getBacklinks";
export const getUnlinkedReferencesChannel = "workspace:getUnlinkedReferences";
export const applyUnlinkedReferenceChannel = "workspace:applyUnlinkedReference";
export const getWorkspaceTagsChannel = "workspace:getTags";
export const getWorkspaceAliasesChannel = "workspace:getAliases";
export const getWorkspaceGraphChannel = "workspace:getGraph";
export const getFrontmatterValueCandidatesChannel = "workspace:getFrontmatterValueCandidates";
export const searchWorkspaceChannel = "workspace:search";
export const replaceInFileChannel = "workspace:replaceInFile";
export const searchAndReplaceChannel = "workspace:searchAndReplace";
export const applySearchAndReplaceChannel = "workspace:applySearchAndReplace";

export const maxSearchQueryLength = 512;
export const maxReplacementBytes = 1024 * 1024;
export const maxExpectedFileSnapshots = 2000;

export interface GetBacklinksInput {
  path: string;
}

export interface GetUnlinkedReferencesInput {
  path: string;
}

export interface ApplyUnlinkedReferenceInput {
  from: number;
  matchText: string;
  sourcePath: string;
  targetPath: string;
  to: number;
}

export interface ApplyUnlinkedReferenceResult {
  content: string;
  sourcePath: string;
}

export type SearchMode = "fullText" | "fileName" | "tag" | "frontmatter";

export interface SearchWorkspaceInput {
  frontmatterField?: string;
  mode: SearchMode;
  query: string;
}

export interface ReplaceInFileInput {
  isRegex: boolean;
  path: string;
  replacement: string;
  searchQuery: string;
}

export interface SearchAndReplaceMatch {
  lineNumber: number;
  lineText: string;
  newLineText: string;
  path: string;
}

export interface SearchAndReplacePreviewResult {
  fileSnapshots: SearchAndReplaceFileSnapshot[];
  matches: SearchAndReplaceMatch[];
  skippedUnreadableFiles: string[];
  truncated: boolean;
}

export interface SearchAndReplaceFileSnapshot {
  contentHash: string;
  path: string;
}

export interface SearchAndReplaceInput {
  expectedFileSnapshots?: SearchAndReplaceFileSnapshot[];
  isRegex: boolean;
  replacement: string;
  searchQuery: string;
}

export interface ReplaceInFileResult {
  count: number;
}

export interface ApplySearchAndReplaceResult {
  count: number;
  skippedUnreadableFiles: string[];
}

export interface Backlink {
  count: number;
  sourceName: string;
  sourcePath: string;
}

export interface UnlinkedReference {
  from: number;
  lineNumber: number;
  lineText: string;
  linkText: string;
  matchText: string;
  sourceName: string;
  sourcePath: string;
  targetPath: string;
  to: number;
}

export interface UnlinkedReferencesResult {
  references: UnlinkedReference[];
  skippedUnreadableFileCount: number;
  truncated: boolean;
}

export interface WorkspaceTagSummary {
  count: number;
  tag: string;
}

export type WorkspaceGraphNodeType = "attachment" | "file" | "tag" | "unresolved";

export interface WorkspaceGraphNode {
  backlinkCount: number;
  category?: string;
  exists: boolean;
  id: string;
  label: string;
  linkCount: number;
  path: string | null;
  type: WorkspaceGraphNodeType;
}

export interface WorkspaceGraphLink {
  count: number;
  source: string;
  target: string;
  type: "link" | "tag";
}

export interface WorkspaceGraph {
  links: WorkspaceGraphLink[];
  nodes: WorkspaceGraphNode[];
}

export interface WorkspaceSearchResult {
  fileName: string;
  lineNumber: number | null;
  lineText: string;
  path: string;
}

export interface WorkspaceSearchResultSet {
  results: WorkspaceSearchResult[];
  skippedLongLines: number;
  skippedLargeFiles: number;
  truncated: boolean;
}

export interface SearchApi {
  getBacklinks: (input: GetBacklinksInput) => Promise<RelicResult<Backlink[]>>;
  getUnlinkedReferences: (input: GetUnlinkedReferencesInput) => Promise<RelicResult<UnlinkedReferencesResult>>;
  applyUnlinkedReference: (input: ApplyUnlinkedReferenceInput) => Promise<RelicResult<ApplyUnlinkedReferenceResult>>;
  getWorkspaceAliases: () => Promise<RelicResult<AliasIndex>>;
  getWorkspaceGraph: () => Promise<RelicResult<WorkspaceGraph>>;
  getFrontmatterValueCandidates: () => Promise<RelicResult<Record<string, string[]>>>;
  getWorkspaceTags: () => Promise<RelicResult<WorkspaceTagSummary[]>>;
  applySearchAndReplace: (input: SearchAndReplaceInput) => Promise<RelicResult<ApplySearchAndReplaceResult>>;
  replaceInFile: (input: ReplaceInFileInput) => Promise<RelicResult<ReplaceInFileResult>>;
  searchAndReplace: (input: SearchAndReplaceInput) => Promise<RelicResult<SearchAndReplacePreviewResult>>;
  searchWorkspace: (input: SearchWorkspaceInput) => Promise<RelicResult<WorkspaceSearchResultSet>>;
}

export const searchIpcContract = {
  getBacklinks: { channel: getBacklinksChannel, main: "handle", transport: "invoke", validatesInput: true },
  getUnlinkedReferences: { channel: getUnlinkedReferencesChannel, main: "handle", transport: "invoke", validatesInput: true },
  applyUnlinkedReference: { channel: applyUnlinkedReferenceChannel, main: "handle", transport: "invoke", validatesInput: true },
  getWorkspaceAliases: { channel: getWorkspaceAliasesChannel, main: "handle", transport: "invoke", validatesInput: false },
  getWorkspaceGraph: { channel: getWorkspaceGraphChannel, main: "handle", transport: "invoke", validatesInput: false },
  getFrontmatterValueCandidates: { channel: getFrontmatterValueCandidatesChannel, main: "handle", transport: "invoke", validatesInput: false },
  getWorkspaceTags: { channel: getWorkspaceTagsChannel, main: "handle", transport: "invoke", validatesInput: false },
  applySearchAndReplace: { channel: applySearchAndReplaceChannel, main: "handle", transport: "invoke", validatesInput: true },
  replaceInFile: { channel: replaceInFileChannel, main: "handle", transport: "invoke", validatesInput: true },
  searchAndReplace: { channel: searchAndReplaceChannel, main: "handle", transport: "invoke", validatesInput: true },
  searchWorkspace: { channel: searchWorkspaceChannel, main: "handle", transport: "invoke", validatesInput: true }
} as const satisfies IpcFeatureContract;
