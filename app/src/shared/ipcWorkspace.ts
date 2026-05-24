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
  pinnedPaths: string[];
  workspaces: WorkspaceSummary[];
}

export interface WorkspaceChangedEvent {
  changedAt: string;
  workspaceId: string;
  workspacePath: string;
}

export interface CreateMarkdownFileInput {
  name: string;
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

export interface GetBacklinksInput {
  path: string;
}

export type SearchMode = "fullText" | "fileName" | "tag" | "regex" | "frontmatter";

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
}

export interface MoveMarkdownFileInput {
  destinationFolder: string;
  path: string;
}

export interface MoveFolderInput {
  destinationFolder: string;
  path: string;
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

export interface SearchAndReplaceInput {
  isRegex: boolean;
  replacement: string;
  searchQuery: string;
}

export interface ReplaceInFileResult {
  count: number;
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

export interface WorkspaceTagSummary {
  count: number;
  tag: string;
}

export interface WorkspaceSearchResult {
  fileName: string;
  lineNumber: number | null;
  lineText: string;
  path: string;
}

export interface WriteMarkdownFileInput {
  content: string;
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
  name: string;
  path: string;
  type: "file";
}
