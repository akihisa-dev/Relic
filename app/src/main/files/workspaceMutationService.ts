import type { RelicResult } from "../../shared/result";
import { workspaceMutationCoordinator } from "./workspaceDataInvalidation";

/** The identity of the workspace a mutation was authorized against. */
export interface WorkspaceMutationContext {
  workspaceId: string;
  workspacePath: string;
}

export type MutationInvalidation = "workspace" | readonly string[];

export interface WorkspaceMutationInvalidator {
  invalidateAfterMutation(workspaceId?: string, changedPaths?: string[]): void;
}

/**
 * Owns the boundary between a successful filesystem mutation and derived data.
 * Callers supply the already validated workspace identity and the mutation; the
 * low level operation remains responsible for filesystem safety and rollback.
 */
export class WorkspaceMutationService {
  constructor(
    private readonly coordinator: WorkspaceMutationInvalidator = workspaceMutationCoordinator
  ) {}

  async run<T>(
    context: WorkspaceMutationContext,
    mutation: (context: WorkspaceMutationContext) => Promise<RelicResult<T>>,
    invalidation: MutationInvalidation = "workspace"
  ): Promise<RelicResult<T>> {
    const owner = { workspaceId: context.workspaceId, workspacePath: context.workspacePath };
    const result = await mutation(owner);
    if (result.ok) {
      this.coordinator.invalidateAfterMutation(
        owner.workspaceId,
        invalidation === "workspace" ? undefined : [...invalidation]
      );
    }
    return result;
  }
}

export const workspaceMutationService = new WorkspaceMutationService();
