import type { MarkdownFileContent, WorkspaceState } from "../../shared/ipc";
import type { AliasIndex } from "../../shared/links";
import type { FileTab, PaneId, PaneState, Tab } from "../store/editorStore";

export interface WorkspaceFileActionsContext {
  aliasesByPath: AliasIndex;
  closeAllTabs: () => void;
  closeTab: (pane: PaneId, tabId: string) => void;
  existingMarkdownPaths: string[];
  focusedPane: PaneId;
  leftPane: PaneState;
  openFileInPane: (pane: PaneId, file: MarkdownFileContent) => void;
  rightPane: PaneState;
  setLeftPaneScrollHeading: (heading: string | undefined) => void;
  setRightPaneScrollHeading: (heading: string | undefined) => void;
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
  tabs: Record<string, Tab>;
  updateTabMeta: (tabId: string, meta: Pick<FileTab, "name" | "path">) => void;
  workspaceState: WorkspaceState | null;
}
