export type AIWorkspaceRole = "user" | "assistant";

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
  codexAppServerAvailable: boolean;
  history: AIWorkspaceMessage[];
  index: AIWorkspaceIndexSummary;
  pendingOperations: AIWorkspaceFileOperation[];
}

export interface SendAIWorkspaceMessageInput {
  dirtyFilePaths?: string[];
  message: string;
}

export interface RebuildAIWorkspaceIndexInput {
  force?: boolean;
}

export interface ClearAIWorkspaceDataInput {
  includeHistory?: boolean;
  includeIndex?: boolean;
}

export type AIWorkspaceFileOperationStatus = "pending" | "applied" | "discarded" | "failed";

export type AIWorkspaceFileOperationKind = "create" | "update" | "delete";

export interface AIWorkspaceFileOperation {
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
}

export interface DiscardAIWorkspaceOperationsInput {
  operationIds?: string[];
}
