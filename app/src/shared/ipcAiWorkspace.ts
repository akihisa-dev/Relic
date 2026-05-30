export type AIWorkspaceRole = "user" | "assistant";

export const openAIWorkspaceModels = ["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"] as const;
export type OpenAIWorkspaceModel = typeof openAIWorkspaceModels[number];
export const defaultOpenAIWorkspaceModel: OpenAIWorkspaceModel = "gpt-5.4-mini";

export interface AIWorkspaceMessage {
  content: string;
  createdAt: string;
  id: string;
  operations?: AIWorkspaceFileOperation[];
  references: AIWorkspaceReference[];
  role: AIWorkspaceRole;
}

export interface AIWorkspaceReference {
  line?: number;
  path: string;
  preview: string;
}

export interface AIWorkspaceIndexSummary {
  chunkCount: number;
  indexedAt: string | null;
  indexedFileCount: number;
  skippedLargeFiles: AIWorkspaceSkippedFile[];
  unreadableFiles: AIWorkspaceSkippedFile[];
}

export interface AIWorkspaceSkippedFile {
  path: string;
  reason: string;
}

export interface AIWorkspaceState {
  history: AIWorkspaceMessage[];
  index: AIWorkspaceIndexSummary;
  openAIAPIKeyConfigured: boolean;
  operationHistory: AIWorkspaceFileOperation[];
  pendingOperations: AIWorkspaceFileOperation[];
}

export interface AISettingsState {
  model: OpenAIWorkspaceModel;
  openAIAPIKeyConfigured: boolean;
  secureStorageAvailable: boolean;
}

export interface SaveOpenAIAPIKeyInput {
  apiKey: string;
}

export interface SaveAIModelInput {
  model: OpenAIWorkspaceModel;
}

export interface TestOpenAIAPIKeyResult {
  model: OpenAIWorkspaceModel;
  ok: boolean;
}

export interface SendAIWorkspaceMessageInput {
  activeFileContent?: string | null;
  activeFilePath?: string | null;
  dirtyFilePaths?: string[];
  message: string;
}

export interface PreviewAIWorkspaceMessageInput {
  activeFileContent?: string | null;
  activeFilePath?: string | null;
  message: string;
}

export interface AIWorkspaceMessagePreview {
  message: string;
  references: AIWorkspaceReference[];
  requiresExternalAI: boolean;
  skippedLargeFiles: AIWorkspaceSkippedFile[];
  unreadableFiles: AIWorkspaceSkippedFile[];
}

export interface RebuildAIWorkspaceIndexInput {
  force?: boolean;
}

export interface ClearAIWorkspaceDataInput {
  includeHistory?: boolean;
  includeIndex?: boolean;
}

export type AIWorkspaceFileOperationStatus = "pending" | "applied" | "discarded" | "failed" | "stale" | "replaced";

export type AIWorkspaceFileOperationKind = "create" | "update" | "delete";

export interface AIWorkspaceFileOperation {
  baseContentHash?: string;
  baseContent?: string;
  content?: string;
  createdAt: string;
  id: string;
  kind: AIWorkspaceFileOperationKind;
  path: string;
  status: AIWorkspaceFileOperationStatus;
  summary: string;
}

export interface ApplyAIWorkspaceOperationsInput {
  dirtyFilePaths?: string[];
  operationIds?: string[];
  userMessage?: string;
}

export interface DiscardAIWorkspaceOperationsInput {
  operationIds?: string[];
  userMessage?: string;
}
