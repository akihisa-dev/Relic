import { useCallback } from "react";

import type { Translator } from "../i18nModel";
import { relicClient } from "../relicClient";
import type { WorkspaceFileMutationInput } from "./workspaceFileMutationShared";
import { splitDroppedWorkspaceFiles } from "./workspaceFileMutationShared";
import { workspaceFileErrorMessage } from "./workspaceFileError";

export function useWorkspaceFileImportActions({
  beginWorkspaceRequest,
  focusedPane,
  openImageInPane,
  setWorkspaceError,
  setWorkspaceState,
  t
}: Pick<WorkspaceFileMutationInput,
  "beginWorkspaceRequest" | "focusedPane" | "openImageInPane" | "setWorkspaceError" | "setWorkspaceState"
> & { t: Translator }) {
  const handleImportMarkdownFiles = useCallback((sourcePaths: string[], destinationFolder: string): void => {
    const relic = relicClient.current;
    if (!relic || sourcePaths.length === 0) return;
    const isCurrentWorkspace = beginWorkspaceRequest();
    if (!isCurrentWorkspace()) return;
    const { imageSourcePaths, markdownSourcePaths } = splitDroppedWorkspaceFiles(sourcePaths);

    void (async () => {
      try {
        if (markdownSourcePaths.length > 0) {
          const result = await relic.importMarkdownFiles({ destinationFolder, sourcePaths: markdownSourcePaths });
          if (!isCurrentWorkspace()) return;
          if (!result.ok) {
            setWorkspaceError(workspaceFileErrorMessage(result.error, t));
            return;
          }
          setWorkspaceState(result.value);
        }

        const importedImagePaths: string[] = [];
        for (const sourcePath of imageSourcePaths) {
          if (!isCurrentWorkspace()) return;
          const result = await relic.importImageFile({ destinationFolder, sourcePath });
          if (!isCurrentWorkspace()) return;
          if (!result.ok) {
            setWorkspaceError(workspaceFileErrorMessage(result.error, t));
            return;
          }
          importedImagePaths.push(result.value.path);
        }
        if (importedImagePaths.length > 0) {
          const stateResult = await relic.getWorkspaceState();
          if (!isCurrentWorkspace()) return;
          if (stateResult.ok) setWorkspaceState(stateResult.value);
        }
        for (const imagePath of importedImagePaths) {
          openImageInPane(focusedPane, { name: imagePath.split("/").at(-1) ?? imagePath, path: imagePath });
        }
      } catch {
        if (isCurrentWorkspace()) setWorkspaceError(t("errors.operationFailed"));
      }
    })();
  }, [beginWorkspaceRequest, focusedPane, openImageInPane, setWorkspaceError, setWorkspaceState, t]);

  return { handleImportMarkdownFiles };
}
