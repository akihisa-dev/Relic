import { useCallback, useState } from "react";

import { ensureMarkdownExtension } from "../../shared/markdownExtension";
import {
  findCreatedMarkdownPath,
  nextUniqueFileName,
  nextUniqueDiagramFileName,
  nextUniqueFolderName
} from "./workspaceFileActionHelpers";
import {
  emptyRelicFreeDrawingMarkdownContent,
  emptyRelicRelationshipMarkdownContent,
  emptyRelicWhyTreeMarkdownContent,
  type RelicDiagramType
} from "../../shared/diagramMarkdown";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";
import type { Translator } from "../i18nModel";

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
    if (!window.relic) return;

    const fileName = fileNameDraft.trim() || nextUniqueFileName(workspaceState, t);

    setIsCreatingFile(true);
    setWorkspaceError(null);

    void window.relic
      .createMarkdownFile({ name: fileName })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setFileNameDraft("");
          const expectedPath = ensureMarkdownExtension(fileName);
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
    t,
    workspaceState
  ]);

  const handleCreateNoteFromPane = useCallback((name: string): void => {
    if (!window.relic) return;

    const fileName = name.trim() || nextUniqueFileName(workspaceState, t);

    void window.relic
      .createMarkdownFile({ name: fileName })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          const expectedPath = ensureMarkdownExtension(fileName);
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
    t,
    workspaceState
  ]);

  const handleCreateDiagramFile = useCallback((diagramType: RelicDiagramType): void => {
    if (!window.relic) return;

    const fileName = nextUniqueDiagramFileName(workspaceState, t, diagramType);
    const expectedPath = ensureMarkdownExtension(fileName);
    const content = diagramType === "why-tree"
      ? emptyRelicWhyTreeMarkdownContent
      : diagramType === "free-drawing"
        ? emptyRelicFreeDrawingMarkdownContent
        : emptyRelicRelationshipMarkdownContent;

    setIsCreatingFile(true);
    setWorkspaceError(null);

    void window.relic
      .createMarkdownFile({ name: fileName })
      .then(async (createResult) => {
        if (!createResult.ok) {
          setWorkspaceError(createResult.error.message);
          return;
        }

        const createdPath = findCreatedMarkdownPath(createResult.value.fileTree, expectedPath) ?? expectedPath;
        const writeResult = await window.relic!.writeMarkdownFile({
          content,
          expectedContent: "",
          path: createdPath
        });

        if (!writeResult.ok) {
          setWorkspaceError(writeResult.error.message);
          return;
        }

        const workspaceResult = await window.relic!.getWorkspaceState();
        if (!workspaceResult.ok) {
          setWorkspaceError(workspaceResult.error.message);
          return;
        }

        setWorkspaceState(workspaceResult.value);
        const readResult = await window.relic!.readMarkdownFile({ path: createdPath });
        if (readResult.ok) {
          openFileInPane(focusedPane, readResult.value);
        } else {
          setWorkspaceError(readResult.error.message);
        }
      })
      .finally(() => setIsCreatingFile(false));
  }, [
    focusedPane,
    openFileInPane,
    setWorkspaceError,
    setWorkspaceState,
    t,
    workspaceState
  ]);

  const handleCreateFolder = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingFolder(true);
    setWorkspaceError(null);

    void window.relic
      .createFolder({ name: folderNameDraft.trim() || nextUniqueFolderName(workspaceState, t) })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setFolderNameDraft("");
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingFolder(false));
  }, [folderNameDraft, setWorkspaceError, setWorkspaceState, t, workspaceState]);

  return {
    fileNameDraft,
    folderNameDraft,
    handleCreateFile,
    handleCreateDiagramFile,
    handleCreateFolder,
    handleCreateNoteFromPane,
    isCreatingFile,
    isCreatingFolder,
    setFileNameDraft,
    setFolderNameDraft,
    setIsCreatingFile
  };
}
