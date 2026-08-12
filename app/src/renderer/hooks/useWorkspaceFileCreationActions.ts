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
import type { WorkspaceRequestGuard } from "./useWorkspaceRequestGuard";
import { workspaceFileErrorMessage } from "./workspaceFileError";

type WorkspaceFileCreationInput = Pick<
  WorkspaceFileActionsContext,
  "focusedPane" | "openFileInPane" | "setWorkspaceError" | "setWorkspaceState" | "workspaceState"
> & {
  t: Translator;
} & Pick<WorkspaceRequestGuard, "beginWorkspaceRequest">;

export function useWorkspaceFileCreationActions({
  beginWorkspaceRequest,
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
    const relic = relicClient.current;
    if (!relic) return;
    if (workspaceState?.availability?.fileOperationsAvailable === false) {
      setWorkspaceError(t("files.workspaceUnavailableOperations"));
      return;
    }

    const fileName = fileNameDraft.trim() || nextUniqueFileName(workspaceState, t);
    const isCurrentWorkspace = beginWorkspaceRequest();
    if (!isCurrentWorkspace()) return;

    setIsCreatingFile(true);
    setWorkspaceError(null);

    void relic
      .createMarkdownFile({ name: fileName })
      .then((result) => {
        if (!isCurrentWorkspace()) return;
        if (result.ok) {
          setWorkspaceState(result.value);
          setFileNameDraft("");
          const expectedPath = ensureMarkdownExtension(fileName);
          void relic.readMarkdownFile({ path: expectedPath }).then((readResult) => {
            if (isCurrentWorkspace() && readResult.ok) {
              openFileInPane(focusedPane, readResult.value);
            }
          }).catch(() => {
            if (isCurrentWorkspace()) setWorkspaceError(t("errors.operationFailed"));
          });
        } else {
          setWorkspaceError(workspaceFileErrorMessage(result.error, t));
        }
      }).catch(() => {
        if (isCurrentWorkspace()) setWorkspaceError(t("errors.operationFailed"));
      })
      .finally(() => setIsCreatingFile(false));
  }, [
    beginWorkspaceRequest,
    fileNameDraft,
    focusedPane,
    openFileInPane,
    setWorkspaceError,
    setWorkspaceState,
    t,
    workspaceState
  ]);

  const handleCreateNoteFromPane = useCallback((name: string): void => {
    const relic = relicClient.current;
    if (!relic) return;
    if (workspaceState?.availability?.fileOperationsAvailable === false) {
      setWorkspaceError(t("files.workspaceUnavailableOperations"));
      return;
    }

    const fileName = name.trim() || nextUniqueFileName(workspaceState, t);
    const isCurrentWorkspace = beginWorkspaceRequest();
    if (!isCurrentWorkspace()) return;

    void relic
      .createMarkdownFile({ name: fileName })
      .then((result) => {
        if (!isCurrentWorkspace()) return;
        if (result.ok) {
          setWorkspaceState(result.value);
          const expectedPath = ensureMarkdownExtension(fileName);
          const newFile = findCreatedMarkdownPath(result.value.fileTree, expectedPath);

          if (newFile) {
            void relic.readMarkdownFile({ path: newFile }).then((readResult) => {
              if (isCurrentWorkspace() && readResult.ok) {
                openFileInPane(focusedPane, readResult.value);
              }
            }).catch(() => {
              if (isCurrentWorkspace()) setWorkspaceError(t("errors.operationFailed"));
            });
          }
        } else {
          setWorkspaceError(workspaceFileErrorMessage(result.error, t));
        }
      }).catch(() => {
        if (isCurrentWorkspace()) setWorkspaceError(t("errors.operationFailed"));
      });
  }, [
    beginWorkspaceRequest,
    focusedPane,
    openFileInPane,
    setWorkspaceError,
    setWorkspaceState,
    t,
    workspaceState
  ]);

  const handleCreateFolder = useCallback((): void => {
    const relic = relicClient.current;
    if (!relic) return;
    if (workspaceState?.availability?.fileOperationsAvailable === false) {
      setWorkspaceError(t("files.workspaceUnavailableOperations"));
      return;
    }

    const isCurrentWorkspace = beginWorkspaceRequest();
    if (!isCurrentWorkspace()) return;
    setIsCreatingFolder(true);
    setWorkspaceError(null);

    void relic
      .createFolder({ name: folderNameDraft.trim() || nextUniqueFolderName(workspaceState, t) })
      .then((result) => {
        if (!isCurrentWorkspace()) return;
        if (result.ok) {
          setWorkspaceState(result.value);
          setFolderNameDraft("");
        } else {
          setWorkspaceError(workspaceFileErrorMessage(result.error, t));
        }
      }).catch(() => {
        if (isCurrentWorkspace()) setWorkspaceError(t("errors.operationFailed"));
      })
      .finally(() => setIsCreatingFolder(false));
  }, [beginWorkspaceRequest, folderNameDraft, setWorkspaceError, setWorkspaceState, t, workspaceState]);

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
