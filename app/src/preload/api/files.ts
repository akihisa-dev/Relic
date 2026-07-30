import { ipcRenderer, webUtils } from "electron";

import {
  copyWorkspaceItemPathChannel,
  createFolderChannel,
  createLinkedMarkdownFileChannel,
  createMarkdownFileChannel,
  duplicateMarkdownFileChannel,
  getLinkUpdateImpactChannel,
  importImageFileChannel,
  importMarkdownFilesChannel,
  moveFolderChannel,
  moveItemToTrashChannel,
  moveMarkdownFileChannel,
  readImageFileChannel,
  readMarkdownFileChannel,
  readPdfFileChannel,
  renameFolderChannel,
  renameMarkdownFileChannel,
  revealWorkspaceItemChannel,
  startWorkspaceFileDragChannel,
  type FilesApi
} from "../../shared/ipc/files";

export const filesApiFragment: FilesApi = {
  copyWorkspaceItemPath: (input) => ipcRenderer.invoke(copyWorkspaceItemPathChannel, input),
  createFolder: (input) => ipcRenderer.invoke(createFolderChannel, input),
  importMarkdownFiles: (input) => ipcRenderer.invoke(importMarkdownFilesChannel, input),
  importImageFile: (input) => ipcRenderer.invoke(importImageFileChannel, input),
  readImageFile: (input) => ipcRenderer.invoke(readImageFileChannel, input),
  readPdfFile: (input) => ipcRenderer.invoke(readPdfFileChannel, input),
  createLinkedMarkdownFile: (input) =>
    ipcRenderer.invoke(createLinkedMarkdownFileChannel, input),
  createMarkdownFile: (input) => ipcRenderer.invoke(createMarkdownFileChannel, input),
  getDroppedFilePath: (file) => webUtils.getPathForFile(file),
  duplicateMarkdownFile: (input) => ipcRenderer.invoke(duplicateMarkdownFileChannel, input),
  getLinkUpdateImpact: (input) => ipcRenderer.invoke(getLinkUpdateImpactChannel, input),
  moveFolder: (input) => ipcRenderer.invoke(moveFolderChannel, input),
  moveItemToTrash: (input) => ipcRenderer.invoke(moveItemToTrashChannel, input),
  moveMarkdownFile: (input) => ipcRenderer.invoke(moveMarkdownFileChannel, input),
  readMarkdownFile: (input) => ipcRenderer.invoke(readMarkdownFileChannel, input),
  renameMarkdownFile: (input) => ipcRenderer.invoke(renameMarkdownFileChannel, input),
  renameFolder: (input) => ipcRenderer.invoke(renameFolderChannel, input),
  revealWorkspaceItem: (input) => ipcRenderer.invoke(revealWorkspaceItemChannel, input),
  startWorkspaceFileDrag: (input) => {
    ipcRenderer.send(startWorkspaceFileDragChannel, input);
  }
};
