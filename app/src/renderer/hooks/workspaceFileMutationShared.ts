import { isSupportedMarkdownImagePath } from "../../shared/imageFiles";
import { hasMarkdownExtension } from "../../shared/markdownExtension";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";
import type { useWorkspaceMutationRunner } from "./useWorkspaceMutationRunner";

export type WorkspaceFileMutationInput = Pick<
  WorkspaceFileActionsContext,
  | "beforeMutateWorkspaceItems"
  | "closeTab"
  | "focusedPane"
  | "leftPane"
  | "openFileInPane"
  | "openImageInPane"
  | "rightPane"
  | "setWorkspaceError"
  | "setWorkspaceState"
  | "tabs"
  | "updateTabMeta"
>;

export type WorkspaceMutationRunner = ReturnType<typeof useWorkspaceMutationRunner>;
export type UpdateMovedFileTab = (
  oldPath: string,
  file: { name: string; path: string },
  preferredTabId?: string
) => void;
export type UpdateMovedFolderTabs = (oldPath: string, newPath: string) => void;

export function fileTabIdForPath(tabs: WorkspaceFileMutationInput["tabs"], path: string): string | null {
  const tabEntry = Object.entries(tabs).find(([, tab]) => tab.kind === "file" && tab.path === path);
  return tabEntry?.[0] ?? null;
}

export function splitDroppedWorkspaceFiles(sourcePaths: string[]): {
  imageSourcePaths: string[];
  markdownSourcePaths: string[];
} {
  const imageSourcePaths: string[] = [];
  const markdownSourcePaths: string[] = [];
  for (const sourcePath of sourcePaths) {
    if (hasMarkdownExtension(sourcePath)) markdownSourcePaths.push(sourcePath);
    else if (isSupportedMarkdownImagePath(sourcePath)) imageSourcePaths.push(sourcePath);
    else markdownSourcePaths.push(sourcePath);
  }
  return { imageSourcePaths, markdownSourcePaths };
}
