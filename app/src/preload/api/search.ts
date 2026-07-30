import { ipcRenderer } from "electron";

import {
  applySearchAndReplaceChannel,
  applyUnlinkedReferenceChannel,
  getBacklinksChannel,
  getFrontmatterValueCandidatesChannel,
  getUnlinkedReferencesChannel,
  getWorkspaceAliasesChannel,
  getWorkspaceGraphChannel,
  getWorkspaceTagsChannel,
  replaceInFileChannel,
  searchAndReplaceChannel,
  searchWorkspaceChannel,
  type SearchApi
} from "../../shared/ipc/search";

export const searchApiFragment: SearchApi = {
  getBacklinks: (input) => ipcRenderer.invoke(getBacklinksChannel, input),
  getUnlinkedReferences: (input) =>
    ipcRenderer.invoke(getUnlinkedReferencesChannel, input),
  applyUnlinkedReference: (input) =>
    ipcRenderer.invoke(applyUnlinkedReferenceChannel, input),
  getWorkspaceAliases: () => ipcRenderer.invoke(getWorkspaceAliasesChannel),
  getWorkspaceGraph: () => ipcRenderer.invoke(getWorkspaceGraphChannel),
  getFrontmatterValueCandidates: () =>
    ipcRenderer.invoke(getFrontmatterValueCandidatesChannel),
  getWorkspaceTags: () => ipcRenderer.invoke(getWorkspaceTagsChannel),
  applySearchAndReplace: (input) =>
    ipcRenderer.invoke(applySearchAndReplaceChannel, input),
  replaceInFile: (input) => ipcRenderer.invoke(replaceInFileChannel, input),
  searchAndReplace: (input) => ipcRenderer.invoke(searchAndReplaceChannel, input),
  searchWorkspace: (input) => ipcRenderer.invoke(searchWorkspaceChannel, input)
};
