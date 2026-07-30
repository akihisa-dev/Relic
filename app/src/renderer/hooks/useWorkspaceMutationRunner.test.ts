import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "../../shared/i18n";
import { useWorkspaceMutationRunner } from "./useWorkspaceMutationRunner";
import { useWorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

describe("useWorkspaceMutationRunner", () => {
  afterEach(() => {
    window.relic = undefined;
  });

  it("保存確認待ちの間にワークスペースが切り替わった場合は旧pathのIPCを開始しない", async () => {
    let allowMutation!: (allowed: boolean) => void;
    const beforeMutateWorkspaceItems = vi.fn().mockReturnValue(new Promise<boolean>((resolve) => {
      allowMutation = resolve;
    }));
    const action = vi.fn().mockResolvedValue({ ok: true, value: "done" });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => {
      const guard = useWorkspaceRequestGuard("workspace-a");
      return {
        guard,
        runner: useWorkspaceMutationRunner({
          beginWorkspaceRequest: guard.beginWorkspaceRequest,
          beforeMutateWorkspaceItems,
          setWorkspaceError: vi.fn(),
          t: createTranslator("ja")
        })
      };
    });

    let mutation!: Promise<boolean>;
    act(() => {
      mutation = result.current.runner.runWorkspaceMutation(
        [{ path: "SameName.md", type: "file" }],
        action,
        onSuccess
      );
    });
    act(() => result.current.guard.invalidateWorkspaceRequests());
    await act(async () => allowMutation(true));

    await expect(mutation).resolves.toBe(false);
    expect(action).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("IPC完了前にワークスペースが切り替わった場合は旧結果をUIへ適用しない", async () => {
    let resolveAction!: (value: { ok: true; value: string }) => void;
    const action = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveAction = resolve;
    }));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => {
      const guard = useWorkspaceRequestGuard("workspace-a");
      return {
        guard,
        runner: useWorkspaceMutationRunner({
          beginWorkspaceRequest: guard.beginWorkspaceRequest,
          setWorkspaceError: vi.fn(),
          t: createTranslator("ja")
        })
      };
    });

    let mutation!: Promise<boolean>;
    act(() => {
      mutation = result.current.runner.runWorkspaceMutation(
        [{ path: "A.md", type: "file" }],
        action,
        onSuccess
      );
    });
    act(() => result.current.guard.invalidateWorkspaceRequests());
    await act(async () => resolveAction({ ok: true, value: "done" }));

    await expect(mutation).resolves.toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
