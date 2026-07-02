export interface AppInfo {
  name: "Relic";
  version: string;
  platform: NodeJS.Platform;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  path: string;
}

export interface WorkspaceState {
  activeWorkspace: WorkspaceSummary | null;
  fileTree: WorkspaceTreeNode[];
  fileIndex?: WorkspaceFileIndexEntry[];
  pinnedPaths: string[];
  workspaces: WorkspaceSummary[];
}

export interface WorkspaceChangedEvent {
  changedAt: string;
  workspaceId: string;
}

export interface CreateMarkdownFileInput {
  name: string;
}

export interface ImportMarkdownFilesInput {
  destinationFolder: string;
  sourcePaths: string[];
}

export interface ImportImageFileInput {
  destinationFolder: string;
  sourcePath: string;
}

export interface ImportImageFileResult {
  path: string;
}

export interface ReadImageFileInput {
  path: string;
}

export interface ReadImageFileResult {
  dataUrl: string;
}

export interface ReadPdfFileInput {
  path: string;
}

export interface ReadPdfFileResult {
  dataUrl: string;
}

export interface CreateLinkedMarkdownFileInput {
  path: string;
}

export interface CreateFolderInput {
  name: string;
  parentFolder?: string;
}

export interface ReadMarkdownFileInput {
  path: string;
}

export interface FileRecoveryInput {
  path: string;
}

export interface ReadFileRecoverySnapshotInput {
  path: string;
  snapshotId: string;
}

export interface FileRecoveryEntry {
  createdAt: string;
  id: string;
  path: string;
  size: number;
}

export interface FileRecoverySnapshot {
  content: string;
  createdAt: string;
  path: string;
  size: number;
  workspaceId: string;
}

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

export interface DuplicateMarkdownFileInput {
  path: string;
}

export interface RenameMarkdownFileInput {
  newName: string;
  path: string;
}

export interface RenameFolderInput {
  newName: string;
  path: string;
}

export interface MoveItemToTrashInput {
  path: string;
  type: "file" | "folder";
}

export interface RevealWorkspaceItemInput {
  path: string;
  workspaceId?: string;
}

export interface StartWorkspaceFileDragInput {
  paths: string[];
}

export interface MoveMarkdownFileInput {
  destinationFolder: string;
  path: string;
}

export interface MoveFolderInput {
  destinationFolder: string;
  path: string;
}

export type LinkUpdateImpactKind = "file" | "folder";

export interface LinkUpdateImpactInput {
  kind: LinkUpdateImpactKind;
  newPath: string;
  oldPath: string;
}

export interface LinkUpdateImpact {
  fileCount: number;
  linkCount: number;
  unreadableFileCount: number;
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

export interface SwitchWorkspaceInput {
  workspaceId: string;
}

export interface RemoveWorkspaceInput {
  workspaceId: string;
}

export interface RenameWorkspaceInput {
  name: string;
  workspaceId: string;
}

export interface MarkdownFileContent {
  content: string;
  name: string;
  path: string;
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

export type WorkspaceFileKind = "markdown";
export type WorkspaceTreeFileKind = "image" | "markdown" | "pdf";

export type WorkspaceFileReadStatus = "ok" | "unreadable";

export interface WorkspaceFileIndexEntry {
  kind: WorkspaceFileKind;
  mtimeMs: number;
  name: string;
  path: string;
  readStatus: WorkspaceFileReadStatus;
  size: number;
}

export interface WriteMarkdownFileInput {
  content: string;
  expectedContent?: string;
  path: string;
}

export interface RenameMarkdownFileResult {
  file: MarkdownFileContent;
  workspaceState: WorkspaceState;
}

export type CreateLinkedMarkdownFileResult = RenameMarkdownFileResult;

export type WorkspaceTreeNode = WorkspaceFolderNode | WorkspaceFileNode;

export interface WorkspaceFolderNode {
  children: WorkspaceTreeNode[];
  name: string;
  path: string;
  type: "folder";
}

export interface WorkspaceFileNode {
  kind?: WorkspaceTreeFileKind;
  name: string;
  path: string;
  type: "file";
}
