import { describe, expect, it, vi } from "vitest";

import { ok, type RelicResult } from "../../shared/result";
import { WorkspaceMutationService, type WorkspaceMutationContext } from "./workspaceMutationService";

describe("WorkspaceMutationService", () => {
  const context: WorkspaceMutationContext = { workspaceId: "owner", workspacePath: "/workspace-owner" };

  function createService() {
    const coordinator = { invalidateAfterMutation: vi.fn() };
    return { coordinator, service: new WorkspaceMutationService(coordinator) };
  }

  it("passes the owner context to the mutation and invalidates successful mutations", async () => {
    const { coordinator, service } = createService();
    const mutation = vi.fn(async (owner: WorkspaceMutationContext): Promise<RelicResult<string>> => {
      expect(owner.workspacePath).toBe("/workspace-owner");
      return ok("partial");
    });

    await expect(service.run(context, mutation, ["note.md"])).resolves.toEqual(ok("partial"));
    expect(coordinator.invalidateAfterMutation).toHaveBeenCalledWith("owner", ["note.md"]);
  });

  it("does not invalidate failed or thrown mutations", async () => {
    const { coordinator, service } = createService();
    const failed = await service.run(context, async () => ({
      ok: false as const,
      error: { code: "FAILED", message: "failed" }
    }));
    expect(failed.ok).toBe(false);
    expect(coordinator.invalidateAfterMutation).not.toHaveBeenCalled();

    await expect(service.run(context, async () => {
      throw new Error("boom");
    })).rejects.toThrow("boom");
    expect(coordinator.invalidateAfterMutation).not.toHaveBeenCalled();
  });

  it("keeps the mutation owner when the caller switches active workspace", async () => {
    const { coordinator, service } = createService();
    const owner = { ...context };
    const switched = { workspaceId: "new", workspacePath: "/workspace-new" };
    const result = await service.run(owner, async (mutationOwner) => {
      Object.assign(owner, switched);
      return ok(mutationOwner.workspacePath);
    });

    expect(result).toEqual(ok("/workspace-owner"));
    expect(coordinator.invalidateAfterMutation).toHaveBeenCalledWith("owner", undefined);
  });
});
