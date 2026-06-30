import type { MarkdownFileContent, WorkspaceState } from "../../shared/ipc";
import type { AliasIndex } from "../../shared/links";
import type { HeadingScrollTarget } from "../editorDerivedState";
import type { FileTab, PaneId, PaneState, Tab } from "../store/editorStore";

export interface WorkspaceFileActionsContext {
  aliasesByPath: AliasIndex;
  beforeMutateWorkspaceItems?: (items: Array<{ path: string; type: "file" | "folder" }>) => Promise<boolean> | boolean;
  closeAllTabs: () => void;
  closeTab: (pane: PaneId, tabId: string) => void;
  existingMarkdownPaths: string[];
  focusedPane: PaneId;
  leftPane: PaneState;
  openFileInPane: (pane: PaneId, file: MarkdownFileContent) => void;
  openImageInPane: (pane: PaneId, image: { name: string; path: string }) => void;
  rightPane: PaneState;
  setLeftPaneScrollHeading: (heading: HeadingScrollTarget | undefined) => void;
  setRightPaneScrollHeading: (heading: HeadingScrollTarget | undefined) => void;
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
  tabs: Record<string, Tab>;
  updateTabMeta: (tabId: string, meta: Pick<FileTab, "name" | "path">) => void;
  workspaceState: WorkspaceState | null;
}
