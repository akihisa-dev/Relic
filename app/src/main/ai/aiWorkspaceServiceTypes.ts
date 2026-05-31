import type {
  AIProvider,
  AIWorkspaceFileOperation
} from "../../shared/ipc";

export interface AIWorkspaceContext {
  userDataPath: string;
  workspaceId: string;
  workspacePath: string;
}

export interface RejectedAIWorkspaceOperation {
  path: string;
  reason: string;
}

export interface PreparedAIWorkspaceOperations {
  operations: AIWorkspaceFileOperation[];
  rejectedOperations: RejectedAIWorkspaceOperation[];
}

export interface AppliedAIWorkspaceOperations {
  applied: AIWorkspaceFileOperation[];
  blockedDirtyPaths: string[];
  failed: AIWorkspaceFileOperation[];
  stale: AIWorkspaceFileOperation[];
}

export interface AIWorkspaceTurnResult {
  message: string;
  operations: AIWorkspaceFileOperation[];
}

export interface AIWorkspaceTurnFailure {
  aiError: string | null;
  provider: AIProvider;
}
