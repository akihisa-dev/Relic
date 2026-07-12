import { describe, expect, it, vi } from "vitest";

import { WorkspaceMutationCoordinator } from "./workspaceDataInvalidation";

describe("workspaceDataInvalidation", () => {
  it("派生データと検索要求を同じワークスペース単位で無効化する", () => {
    const derivedData = { invalidate: vi.fn() };
    const searchRequests = { invalidate: vi.fn() };
    const coordinator = new WorkspaceMutationCoordinator({ derivedData, searchRequests });

    coordinator.invalidateAfterMutation("workspace-1");

    expect(derivedData.invalidate).toHaveBeenCalledWith("workspace-1", undefined);
    expect(searchRequests.invalidate).toHaveBeenCalledWith("workspace-1");
  });

  it("IDなしでは両方の全キャッシュを無効化する", () => {
    const derivedData = { invalidate: vi.fn() };
    const searchRequests = { invalidate: vi.fn() };
    const coordinator = new WorkspaceMutationCoordinator({ derivedData, searchRequests });

    coordinator.invalidateAfterMutation();

    expect(derivedData.invalidate).toHaveBeenCalledWith(undefined, undefined);
    expect(searchRequests.invalidate).toHaveBeenCalledWith(undefined);
  });

  it("変更パスは派生データだけへ渡し、検索要求は世代単位で無効化する", () => {
    const derivedData = { invalidate: vi.fn() };
    const searchRequests = { invalidate: vi.fn() };
    const coordinator = new WorkspaceMutationCoordinator({ derivedData, searchRequests });

    coordinator.invalidateAfterMutation("workspace-1", ["note.md"]);

    expect(derivedData.invalidate).toHaveBeenCalledWith("workspace-1", ["note.md"]);
    expect(searchRequests.invalidate).toHaveBeenCalledWith("workspace-1");
  });

  it("アプリ内保存に対応する監視イベントは重複無効化しない", () => {
    const derivedData = { invalidate: vi.fn() };
    const searchRequests = { invalidate: vi.fn() };
    const coordinator = new WorkspaceMutationCoordinator({ derivedData, searchRequests }, () => 1000);

    coordinator.invalidateAfterMutation("workspace-1", ["note.md"]);
    coordinator.invalidateWatcherEvents("workspace-1", [{ eventType: "rename", filename: "note.md" }]);

    expect(derivedData.invalidate).toHaveBeenCalledTimes(1);
    expect(searchRequests.invalidate).toHaveBeenCalledTimes(1);
  });

  it("外部Markdown変更は対象パスだけを無効化する", () => {
    const derivedData = { invalidate: vi.fn() };
    const searchRequests = { invalidate: vi.fn() };
    const coordinator = new WorkspaceMutationCoordinator({ derivedData, searchRequests });

    coordinator.invalidateWatcherEvents("workspace-1", [
      { eventType: "change", filename: "folder\\note.md" }
    ]);

    expect(derivedData.invalidate).toHaveBeenCalledWith("workspace-1", ["folder/note.md"]);
    expect(searchRequests.invalidate).toHaveBeenCalledWith("workspace-1");
  });

  it("外部renameやパス不明イベントは全体を無効化する", () => {
    const derivedData = { invalidate: vi.fn() };
    const searchRequests = { invalidate: vi.fn() };
    const coordinator = new WorkspaceMutationCoordinator({ derivedData, searchRequests });

    coordinator.invalidateWatcherEvents("workspace-1", [{ eventType: "rename", filename: "note.md" }]);

    expect(derivedData.invalidate).toHaveBeenCalledWith("workspace-1", undefined);
    expect(searchRequests.invalidate).toHaveBeenCalledWith("workspace-1");
  });
});
