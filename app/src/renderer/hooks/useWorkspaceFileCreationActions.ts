import { useCallback, useState } from "react";

import {
  findCreatedMarkdownPath,
  nextUniqueFileName,
  nextUniqueFolderName
} from "./workspaceFileActionHelpers";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";

type WorkspaceFileCreationInput = Pick<
  WorkspaceFileActionsContext,
  "focusedPane" | "openFileInPane" | "setWorkspaceError" | "setWorkspaceState" | "workspaceState"
>;

export function useWorkspaceFileCreationActions({
  focusedPane,
  openFileInPane,
  setWorkspaceError,
  setWorkspaceState,
  workspaceState
}: WorkspaceFileCreationInput) {
  const [fileNameDraft, setFileNameDraft] = useState("");
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const handleCreateFile = useCallback((): void => {
    if (!window.relic) return;

    const fileName = fileNameDraft.trim() || nextUniqueFileName(workspaceState);

    setIsCreatingFile(true);
    setWorkspaceError(null);

    void window.relic
      .createMarkdownFile({ name: fileName })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setFileNameDraft("");
          const expectedPath = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
          void window.relic!.readMarkdownFile({ path: expectedPath }).then((readResult) => {
            if (readResult.ok) {
              openFileInPane(focusedPane, readResult.value);
            }
          });
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingFile(false));
  }, [
    fileNameDraft,
    focusedPane,
    openFileInPane,
    setWorkspaceError,
    setWorkspaceState,
    workspaceState
  ]);

  const handleCreateNoteFromPane = useCallback((name: string): void => {
    if (!window.relic) return;

    const fileName = name.trim() || nextUniqueFileName(workspaceState);

    void window.relic
      .createMarkdownFile({ name: fileName })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          const expectedPath = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
          const newFile = findCreatedMarkdownPath(result.value.fileTree, expectedPath);

          if (newFile) {
            void window.relic!.readMarkdownFile({ path: newFile }).then((readResult) => {
              if (readResult.ok) openFileInPane(focusedPane, readResult.value);
            });
          }
        } else {
          setWorkspaceError(result.error.message);
        }
      });
  }, [
    focusedPane,
    openFileInPane,
    setWorkspaceError,
    setWorkspaceState,
    workspaceState
  ]);

  const handleCreateFolder = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingFolder(true);
    setWorkspaceError(null);

    void window.relic
      .createFolder({ name: folderNameDraft.trim() || nextUniqueFolderName(workspaceState) })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setFolderNameDraft("");
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingFolder(false));
  }, [folderNameDraft, setWorkspaceError, setWorkspaceState, workspaceState]);

  return {
    fileNameDraft,
    folderNameDraft,
    handleCreateFile,
    handleCreateFolder,
    handleCreateNoteFromPane,
    isCreatingFile,
    isCreatingFolder,
    setFileNameDraft,
    setFolderNameDraft,
    setIsCreatingFile
  };
}
