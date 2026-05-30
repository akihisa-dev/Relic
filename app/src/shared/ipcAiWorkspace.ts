export type AIWorkspaceRole = "user" | "assistant";

export interface AIWorkspaceMessage {
  content: string;
  createdAt: string;
  id: string;
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
}

export interface SendAIWorkspaceMessageInput {
  message: string;
}

export interface RebuildAIWorkspaceIndexInput {
  force?: boolean;
}

export interface ClearAIWorkspaceDataInput {
  includeHistory?: boolean;
  includeIndex?: boolean;
}

