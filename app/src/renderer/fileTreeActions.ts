import type { FileTreeActions, FileTreeProps } from "./fileTreeTypes";

export function fileTreeActionsFromProps({
  actions,
  onDeleteItem,
  onDeleteSelectedItems,
  onCreateFileInFolder,
  onCreateFolderInFolder,
  onDuplicateFile,
  onImportMarkdownFiles,
  onMoveFile,
  onMoveFolder,
  onMoveItems,
  onRunFileTool,
  onOpenFile,
  onOpenInOtherPane,
  onRequestExpansion,
  onRevealItem,
  onRenameItem,
  onSelectFolder,
  onSelectItem,
  onTogglePin
}: FileTreeProps): FileTreeActions {
  return actions ?? {
    onDeleteItem,
    onDeleteSelectedItems,
    onCreateFileInFolder,
    onCreateFolderInFolder,
    onDuplicateFile,
    onImportMarkdownFiles,
    onMoveFile,
    onMoveFolder,
    onMoveItems,
    onRunFileTool,
    onOpenFile,
    onOpenInOtherPane,
    onRequestExpansion,
    onRevealItem,
    onRenameItem,
    onSelectFolder,
    onSelectItem,
    onTogglePin
  };
}
