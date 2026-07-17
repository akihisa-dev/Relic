import { relicClient } from "../relicClient";
import { useCallback, useState } from "react";

import { ensureMarkdownExtension } from "../../shared/markdownExtension";
import {
  findCreatedMarkdownPath,
  nextUniqueFileName,
  nextUniqueFolderName
} from "./workspaceFileActionHelpers";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";
import type { Translator } from "../i18nModel";
import { workspaceFileErrorMessage } from "./workspaceFileError";

type WorkspaceFileCreationInput = Pick<
  WorkspaceFileActionsContext,
  "focusedPane" | "openFileInPane" | "setWorkspaceError" | "setWorkspaceState" | "workspaceState"
> & {
  t: Translator;
};

export function useWorkspaceFileCreationActions({
  focusedPane,
  openFileInPane,
  setWorkspaceError,
  setWorkspaceState,
  t,
  workspaceState
}: WorkspaceFileCreationInput) {
  const [fileNameDraft, setFileNameDraft] = useState("");
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const handleCreateFile = useCallback((): void => {
    if (!relicClient.current) return;

    const fileName = fileNameDraft.trim() || nextUniqueFileName(workspaceState, t);

    setIsCreatingFile(true);
    setWorkspaceError(null);

    void relicClient.current
      .createMarkdownFile({ name: fileName })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setFileNameDraft("");
          const expectedPath = ensureMarkdownExtension(fileName);
          void relicClient.current!.readMarkdownFile({ path: expectedPath }).then((readResult) => {
            if (readResult.ok) {
              openFileInPane(focusedPane, readResult.value);
            }
          });
        } else {
          setWorkspaceError(workspaceFileErrorMessage(result.error, t));
        }
      })
      .finally(() => setIsCreatingFile(false));
  }, [
    fileNameDraft,
    focusedPane,
    openFileInPane,
    setWorkspaceError,
    setWorkspaceState,
    t,
    workspaceState
  ]);

  const handleCreateNoteFromPane = useCallback((name: string): void => {
    if (!relicClient.current) return;

    const fileName = name.trim() || nextUniqueFileName(workspaceState, t);

    void relicClient.current
      .createMarkdownFile({ name: fileName })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          const expectedPath = ensureMarkdownExtension(fileName);
          const newFile = findCreatedMarkdownPath(result.value.fileTree, expectedPath);

          if (newFile) {
            void relicClient.current!.readMarkdownFile({ path: newFile }).then((readResult) => {
              if (readResult.ok) openFileInPane(focusedPane, readResult.value);
            });
          }
        } else {
          setWorkspaceError(workspaceFileErrorMessage(result.error, t));
        }
      });
  }, [
    focusedPane,
    openFileInPane,
    setWorkspaceError,
    setWorkspaceState,
    t,
    workspaceState
  ]);

  const handleCreateFolder = useCallback((): void => {
    if (!relicClient.current) return;

    setIsCreatingFolder(true);
    setWorkspaceError(null);

    void relicClient.current
      .createFolder({ name: folderNameDraft.trim() || nextUniqueFolderName(workspaceState, t) })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setFolderNameDraft("");
        } else {
          setWorkspaceError(workspaceFileErrorMessage(result.error, t));
        }
      })
      .finally(() => setIsCreatingFolder(false));
  }, [folderNameDraft, setWorkspaceError, setWorkspaceState, t, workspaceState]);

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
