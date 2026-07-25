import type { RelicResult } from "../result";
import type { IpcFeatureContract } from "./contract";

export const getAppInfoChannel = "app:getInfo";
export const applicationMenuCommandChannel = "app:menuCommand";
export const updateApplicationMenuStateChannel = "app:updateMenuState";
export const getUserDefinedFieldsChannel = "app:getUserDefinedFields";
export const saveUserDefinedFieldsChannel = "app:saveUserDefinedFields";
export const getFrontmatterTemplatesChannel = "app:getFrontmatterTemplates";
export const saveFrontmatterTemplatesChannel = "app:saveFrontmatterTemplates";

export interface AppInfo {
  name: "Relic";
  version: string;
}

export type ApplicationMenuCommand =
  | "close-tab"
  | "new-note"
  | "open-command-palette"
  | "open-quick-switcher"
  | "open-search"
  | "open-settings"
  | "reopen-closed-tab"
  | "toggle-right-panel"
  | "toggle-sidebar"
  | "toggle-split"
  | "toggle-typewriter";

export interface ApplicationMenuState {
  canCloseTab: boolean;
  canReopenClosedTab: boolean;
  canToggleRightPanel: boolean;
  isRightPanelOpen: boolean;
  isSidebarOpen: boolean;
  isSplit: boolean;
  isTypewriterMode: boolean;
}

export type UserDefinedFieldType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "time"
  | "boolean"
  | "select"
  | "multi-select"
  | "url";

export interface UserDefinedField {
  choices?: string[];
  name: string;
  type: UserDefinedFieldType;
}

export interface FrontmatterTemplate {
  fieldNames: string[];
  name: string;
}

export const defaultUserDefinedFields: UserDefinedField[] = [];
export const defaultFrontmatterTemplates: FrontmatterTemplate[] = [];

export interface SettingsApi {
  getAppInfo: () => Promise<RelicResult<AppInfo>>;
  onApplicationMenuCommand: (callback: (command: ApplicationMenuCommand) => void) => () => void;
  updateApplicationMenuState: (input: ApplicationMenuState) => void;
  getUserDefinedFields: () => Promise<RelicResult<UserDefinedField[]>>;
  saveUserDefinedFields: (input: UserDefinedField[]) => Promise<RelicResult<void>>;
  getFrontmatterTemplates: () => Promise<RelicResult<FrontmatterTemplate[]>>;
  saveFrontmatterTemplates: (input: FrontmatterTemplate[]) => Promise<RelicResult<void>>;
}

export const settingsIpcContract = {
  getAppInfo: { channel: getAppInfoChannel, main: "handle", transport: "invoke", validatesInput: false },
  onApplicationMenuCommand: { channel: applicationMenuCommandChannel, main: "sender", transport: "subscribe", validatesInput: false },
  updateApplicationMenuState: { channel: updateApplicationMenuStateChannel, main: "on", transport: "send", validatesInput: true },
  getUserDefinedFields: { channel: getUserDefinedFieldsChannel, main: "handle", transport: "invoke", validatesInput: false },
  saveUserDefinedFields: { channel: saveUserDefinedFieldsChannel, main: "handle", transport: "invoke", validatesInput: true },
  getFrontmatterTemplates: { channel: getFrontmatterTemplatesChannel, main: "handle", transport: "invoke", validatesInput: false },
  saveFrontmatterTemplates: { channel: saveFrontmatterTemplatesChannel, main: "handle", transport: "invoke", validatesInput: true }
} as const satisfies IpcFeatureContract;
