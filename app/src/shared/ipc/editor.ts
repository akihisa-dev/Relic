import type { RelicResult } from "../result";
import type { IpcFeatureContract } from "./contract";

export const getEditorSettingsChannel = "editor:getSettings";
export const saveEditorSettingsChannel = "editor:saveSettings";
export const copyEditorTextToClipboardChannel = "editor:copyTextToClipboard";
export const readEditorTextFromClipboardChannel = "editor:readTextFromClipboard";
export const writeMarkdownFileChannel = "workspace:writeMarkdownFile";
export const listFileRecoverySnapshotsChannel = "workspace:listFileRecoverySnapshots";
export const readFileRecoverySnapshotChannel = "workspace:readFileRecoverySnapshot";
export const windowCloseRequestedChannel = "window:closeRequested";
export const windowCloseResponseChannel = "window:closeResponse";

export const maxMarkdownWriteBytes = 5 * 1024 * 1024;

export type EditorFont = "system" | "gothic" | "mincho" | "mono";
export type EditorMaxWidth = "550px" | "660px" | "800px" | "none";
export type FrontmatterDateFormat = "dmy" | "mdy" | "system" | "ymd";
export type AppTheme = "light" | "dark" | "system";
export type AppLanguage = "system" | "en" | "ja";

export interface EditorSettings {
  font: EditorFont;
  fontSize: number;
  frontmatterDateFormat: FrontmatterDateFormat;
  language: AppLanguage;
  lineHeight: number;
  maxWidth: EditorMaxWidth;
  showLineNumbers: boolean;
  spellCheck: boolean;
  theme: AppTheme;
}

export const defaultEditorSettings: EditorSettings = {
  font: "system",
  fontSize: 16,
  frontmatterDateFormat: "ymd",
  language: "en",
  lineHeight: 1.7,
  maxWidth: "660px",
  showLineNumbers: false,
  spellCheck: true,
  theme: "system"
};

export interface CopyEditorTextToClipboardInput {
  text: string;
}

export interface FileRecoveryInput {
  path: string;
}

export interface ReadFileRecoverySnapshotInput {
  path: string;
  snapshotId: string;
}

export interface FileRecoveryEntry {
  createdAt: string;
  id: string;
  path: string;
  size: number;
}

export interface FileRecoverySnapshot {
  content: string;
  createdAt: string;
  path: string;
  size: number;
  workspaceId: string;
}

export interface WriteMarkdownFileInput {
  content: string;
  expectedContent?: string;
  path: string;
}

export interface WindowCloseRequestEvent {
  requestId: string;
}

export interface WindowCloseResponseInput {
  ok: boolean;
  requestId: string;
}

export interface EditorApi {
  getEditorSettings: () => Promise<RelicResult<EditorSettings>>;
  saveEditorSettings: (input: EditorSettings) => Promise<RelicResult<void>>;
  writeMarkdownFile: (input: WriteMarkdownFileInput) => Promise<RelicResult<void>>;
  listFileRecoverySnapshots: (input: FileRecoveryInput) => Promise<RelicResult<FileRecoveryEntry[]>>;
  readFileRecoverySnapshot: (input: ReadFileRecoverySnapshotInput) => Promise<RelicResult<FileRecoverySnapshot>>;
  copyEditorTextToClipboard: (input: CopyEditorTextToClipboardInput) => Promise<RelicResult<void>>;
  readEditorTextFromClipboard: () => Promise<RelicResult<string>>;
  onWindowCloseRequested: (callback: (event: WindowCloseRequestEvent) => void) => () => void;
  respondToWindowCloseRequest: (input: WindowCloseResponseInput) => void;
}

export const editorIpcContract = {
  getEditorSettings: { channel: getEditorSettingsChannel, main: "handle", transport: "invoke", validatesInput: false },
  saveEditorSettings: { channel: saveEditorSettingsChannel, main: "handle", transport: "invoke", validatesInput: true },
  writeMarkdownFile: { channel: writeMarkdownFileChannel, main: "handle", transport: "invoke", validatesInput: true },
  listFileRecoverySnapshots: { channel: listFileRecoverySnapshotsChannel, main: "handle", transport: "invoke", validatesInput: true },
  readFileRecoverySnapshot: { channel: readFileRecoverySnapshotChannel, main: "handle", transport: "invoke", validatesInput: true },
  copyEditorTextToClipboard: { channel: copyEditorTextToClipboardChannel, main: "handle", transport: "invoke", validatesInput: true },
  readEditorTextFromClipboard: { channel: readEditorTextFromClipboardChannel, main: "handle", transport: "invoke", validatesInput: false },
  onWindowCloseRequested: { channel: windowCloseRequestedChannel, main: "sender", transport: "subscribe", validatesInput: false },
  respondToWindowCloseRequest: { channel: windowCloseResponseChannel, main: "lifecycle", transport: "send", validatesInput: true }
} as const satisfies IpcFeatureContract;
