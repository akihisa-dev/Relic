import { ipcRenderer, type IpcRendererEvent } from "electron";

import {
  copyEditorTextToClipboardChannel,
  getEditorSettingsChannel,
  listFileRecoverySnapshotsChannel,
  readEditorTextFromClipboardChannel,
  readFileRecoverySnapshotChannel,
  saveEditorSettingsChannel,
  windowCloseRequestedChannel,
  windowCloseResponseChannel,
  writeMarkdownFileChannel,
  type EditorApi,
  type WindowCloseRequestEvent
} from "../../shared/ipc/editor";

export const editorApiFragment: EditorApi = {
  getEditorSettings: () => ipcRenderer.invoke(getEditorSettingsChannel),
  saveEditorSettings: (input) => ipcRenderer.invoke(saveEditorSettingsChannel, input),
  writeMarkdownFile: (input) => ipcRenderer.invoke(writeMarkdownFileChannel, input),
  listFileRecoverySnapshots: (input) =>
    ipcRenderer.invoke(listFileRecoverySnapshotsChannel, input),
  readFileRecoverySnapshot: (input) =>
    ipcRenderer.invoke(readFileRecoverySnapshotChannel, input),
  copyEditorTextToClipboard: (input) =>
    ipcRenderer.invoke(copyEditorTextToClipboardChannel, input),
  readEditorTextFromClipboard: () =>
    ipcRenderer.invoke(readEditorTextFromClipboardChannel),
  onWindowCloseRequested: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: WindowCloseRequestEvent): void => {
      callback(payload);
    };

    ipcRenderer.on(windowCloseRequestedChannel, listener);
    return () => ipcRenderer.removeListener(windowCloseRequestedChannel, listener);
  },
  respondToWindowCloseRequest: (input) => {
    ipcRenderer.send(windowCloseResponseChannel, input);
  }
};
