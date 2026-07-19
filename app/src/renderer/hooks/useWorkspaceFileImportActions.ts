import { useCallback } from "react";

import type { Translator } from "../i18nModel";
import { relicClient } from "../relicClient";
import type { WorkspaceFileMutationInput } from "./workspaceFileMutationShared";
import { splitDroppedWorkspaceFiles } from "./workspaceFileMutationShared";
import { workspaceFileErrorMessage } from "./workspaceFileError";

export function useWorkspaceFileImportActions({
  focusedPane,
  openImageInPane,
  setWorkspaceError,
  setWorkspaceState,
  t
}: Pick<WorkspaceFileMutationInput,
  "focusedPane" | "openImageInPane" | "setWorkspaceError" | "setWorkspaceState"
> & { t: Translator }) {
  const handleImportMarkdownFiles = useCallback((sourcePaths: string[], destinationFolder: string): void => {
    if (!relicClient.current || sourcePaths.length === 0) return;
    const { imageSourcePaths, markdownSourcePaths } = splitDroppedWorkspaceFiles(sourcePaths);

    void (async () => {
      if (markdownSourcePaths.length > 0) {
        const result = await relicClient.current!.importMarkdownFiles({ destinationFolder, sourcePaths: markdownSourcePaths });
        if (!result.ok) {
          setWorkspaceError(workspaceFileErrorMessage(result.error, t));
          return;
        }
        setWorkspaceState(result.value);
      }

      const importedImagePaths: string[] = [];
      for (const sourcePath of imageSourcePaths) {
        const result = await relicClient.current!.importImageFile({ destinationFolder, sourcePath });
        if (!result.ok) {
          setWorkspaceError(workspaceFileErrorMessage(result.error, t));
          return;
        }
        importedImagePaths.push(result.value.path);
      }
      if (importedImagePaths.length > 0) {
        const stateResult = await relicClient.current!.getWorkspaceState();
        if (stateResult.ok) setWorkspaceState(stateResult.value);
      }
      for (const imagePath of importedImagePaths) {
        openImageInPane(focusedPane, { name: imagePath.split("/").at(-1) ?? imagePath, path: imagePath });
      }
    })();
  }, [focusedPane, openImageInPane, setWorkspaceError, setWorkspaceState, t]);

  return { handleImportMarkdownFiles };
}
