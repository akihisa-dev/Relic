import type { RelicResult } from "../result";
import type { IpcFeatureContract } from "./contract";

export const getAppInfoChannel = "app:getInfo";
export const getFeatureTogglesChannel = "app:getFeatureToggles";
export const saveFeatureTogglesChannel = "app:saveFeatureToggles";
export const getUserDefinedFieldsChannel = "app:getUserDefinedFields";
export const saveUserDefinedFieldsChannel = "app:saveUserDefinedFields";
export const getFrontmatterTemplatesChannel = "app:getFrontmatterTemplates";
export const saveFrontmatterTemplatesChannel = "app:saveFrontmatterTemplates";

export interface AppInfo {
  name: "Relic";
  version: string;
}

export interface FeatureToggles {
  cards: boolean;
  chronicle: boolean;
  graph: boolean;
  sphere: boolean;
  table: boolean;
  tools: boolean;
  frontmatter: boolean;
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

export const defaultFeatureToggles: FeatureToggles = {
  cards: false,
  chronicle: false,
  graph: false,
  sphere: false,
  table: false,
  tools: false,
  frontmatter: false
};

export interface SettingsApi {
  getAppInfo: () => Promise<RelicResult<AppInfo>>;
  getFeatureToggles: () => Promise<RelicResult<FeatureToggles>>;
  saveFeatureToggles: (input: FeatureToggles) => Promise<RelicResult<void>>;
  getUserDefinedFields: () => Promise<RelicResult<UserDefinedField[]>>;
  saveUserDefinedFields: (input: UserDefinedField[]) => Promise<RelicResult<void>>;
  getFrontmatterTemplates: () => Promise<RelicResult<FrontmatterTemplate[]>>;
  saveFrontmatterTemplates: (input: FrontmatterTemplate[]) => Promise<RelicResult<void>>;
}

export const settingsIpcContract = {
  getAppInfo: { channel: getAppInfoChannel, main: "handle", transport: "invoke", validatesInput: false },
  getFeatureToggles: { channel: getFeatureTogglesChannel, main: "handle", transport: "invoke", validatesInput: false },
  saveFeatureToggles: { channel: saveFeatureTogglesChannel, main: "handle", transport: "invoke", validatesInput: true },
  getUserDefinedFields: { channel: getUserDefinedFieldsChannel, main: "handle", transport: "invoke", validatesInput: false },
  saveUserDefinedFields: { channel: saveUserDefinedFieldsChannel, main: "handle", transport: "invoke", validatesInput: true },
  getFrontmatterTemplates: { channel: getFrontmatterTemplatesChannel, main: "handle", transport: "invoke", validatesInput: false },
  saveFrontmatterTemplates: { channel: saveFrontmatterTemplatesChannel, main: "handle", transport: "invoke", validatesInput: true }
} as const satisfies IpcFeatureContract;
