import { ipcRenderer, type IpcRendererEvent } from "electron";

import {
  applicationMenuCommandChannel,
  getAppInfoChannel,
  getFrontmatterTemplatesChannel,
  getUserDefinedFieldsChannel,
  saveFrontmatterTemplatesChannel,
  saveUserDefinedFieldsChannel,
  updateApplicationMenuStateChannel,
  type ApplicationMenuCommand,
  type SettingsApi
} from "../../shared/ipc/settings";

export const settingsApiFragment: SettingsApi = {
  getAppInfo: () => ipcRenderer.invoke(getAppInfoChannel),
  onApplicationMenuCommand: (callback) => {
    const listener = (_event: IpcRendererEvent, command: ApplicationMenuCommand): void => {
      callback(command);
    };

    ipcRenderer.on(applicationMenuCommandChannel, listener);
    return () => ipcRenderer.removeListener(applicationMenuCommandChannel, listener);
  },
  updateApplicationMenuState: (input) => {
    ipcRenderer.send(updateApplicationMenuStateChannel, input);
  },
  getUserDefinedFields: () => ipcRenderer.invoke(getUserDefinedFieldsChannel),
  saveUserDefinedFields: (input) => ipcRenderer.invoke(saveUserDefinedFieldsChannel, input),
  getFrontmatterTemplates: () => ipcRenderer.invoke(getFrontmatterTemplatesChannel),
  saveFrontmatterTemplates: (input) =>
    ipcRenderer.invoke(saveFrontmatterTemplatesChannel, input)
};
