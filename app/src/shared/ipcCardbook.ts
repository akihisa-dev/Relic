export interface AppInfo {
  name: "Relic";
  version: string;
  platform: NodeJS.Platform;
}

export interface CardbookSummary {
  id: string;
  name: string;
  path: string;
}

export interface CardbookState {
  activeCardbook: CardbookSummary | null;
  cardTree: CardbookTreeNode[];
  pinnedPaths: string[];
  cardbooks: CardbookSummary[];
}

export interface CardbookChangedEvent {
  changedAt: string;
  cardbookId: string;
  cardbookPath: string;
}

export interface CreateMarkdownCardInput {
  name: string;
}

export interface CreateLinkedMarkdownCardInput {
  path: string;
}

export interface CreateCardFolderInput {
  name: string;
  parentCardFolder?: string;
}

export interface ReadMarkdownCardInput {
  path: string;
}

export interface GetBacklinksInput {
  path: string;
}

export type SearchMode = "fullText" | "cardName" | "tag" | "regex" | "frontmatter";

export interface SearchCardbookInput {
  frontmatterField?: string;
  mode: SearchMode;
  query: string;
}

export interface DuplicateMarkdownCardInput {
  path: string;
}

export interface RenameMarkdownCardInput {
  newName: string;
  path: string;
}

export interface RenameCardFolderInput {
  newName: string;
  path: string;
}

export interface MoveItemToTrashInput {
  path: string;
  type: "card" | "cardFolder";
}

export interface RevealCardbookItemInput {
  path: string;
}

export interface MoveMarkdownCardInput {
  destinationCardFolder: string;
  path: string;
}

export interface MoveCardFolderInput {
  destinationCardFolder: string;
  path: string;
}

export interface ReplaceInCardInput {
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

export interface ReplaceInCardResult {
  count: number;
}

export interface SwitchCardbookInput {
  cardbookId: string;
}

export interface RemoveCardbookInput {
  cardbookId: string;
}

export interface RenameCardbookInput {
  name: string;
  cardbookId: string;
}

export interface MarkdownCardContent {
  content: string;
  name: string;
  path: string;
}

export interface Backlink {
  count: number;
  sourceName: string;
  sourcePath: string;
}

export interface CardbookTagSummary {
  count: number;
  tag: string;
}

export interface CardbookSearchResult {
  cardName: string;
  lineNumber: number | null;
  lineText: string;
  path: string;
}

export interface WriteMarkdownCardInput {
  content: string;
  path: string;
}

export interface RenameMarkdownCardResult {
  card: MarkdownCardContent;
  cardbookState: CardbookState;
}

export type CreateLinkedMarkdownCardResult = RenameMarkdownCardResult;

export type CardbookTreeNode = CardbookCardFolderNode | CardbookCardNode;

export interface CardbookCardFolderNode {
  children: CardbookTreeNode[];
  name: string;
  path: string;
  type: "cardFolder";
}

export interface CardbookCardNode {
  name: string;
  path: string;
  type: "card";
}
