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
    expect(coordinator.invalidateWatcherEvents("workspace-1", [{ eventType: "rename", filename: "note.md" }])).toEqual({ kind: "none" });

    expect(derivedData.invalidate).toHaveBeenCalledTimes(1);
    expect(searchRequests.invalidate).toHaveBeenCalledTimes(1);
  });

  it("同じローカル保存から発生する複数watcher eventをまとめて抑止する", () => {
    const derivedData = { invalidate: vi.fn() };
    const searchRequests = { invalidate: vi.fn() };
    const coordinator = new WorkspaceMutationCoordinator({ derivedData, searchRequests }, () => 1000);

    coordinator.invalidateAfterMutation("workspace-1", ["note.md"]);
    expect(coordinator.invalidateWatcherEvents("workspace-1", [
      { eventType: "change", filename: "note.md" },
      { eventType: "rename", filename: "note.md" }
    ])).toEqual({ kind: "none" });
    expect(derivedData.invalidate).toHaveBeenCalledTimes(1);
  });

  it("外部Markdown変更は対象パスだけを無効化する", () => {
    const derivedData = { invalidate: vi.fn() };
    const searchRequests = { invalidate: vi.fn() };
    const coordinator = new WorkspaceMutationCoordinator({ derivedData, searchRequests });

    expect(coordinator.invalidateWatcherEvents("workspace-1", [
      { eventType: "change", filename: "folder\\note.md" }
    ])).toEqual({ kind: "paths", paths: ["folder/note.md"] });

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

  it("ローカル保存と外部変更の混在burstでは外部pathだけを返す", () => {
    const derivedData = { invalidate: vi.fn() };
    const searchRequests = { invalidate: vi.fn() };
    const coordinator = new WorkspaceMutationCoordinator({ derivedData, searchRequests }, () => 1000);

    coordinator.invalidateAfterMutation("workspace-1", ["local.md"]);
    const result = coordinator.invalidateWatcherEvents("workspace-1", [
      { eventType: "change", filename: "local.md" },
      { eventType: "change", filename: "external.md" }
    ]);

    expect(result).toEqual({ kind: "paths", paths: ["external.md"] });
    expect(derivedData.invalidate).toHaveBeenCalledWith("workspace-1", ["external.md"]);
  });

  it("危険なwatcher pathはfullへ倒して値を返さない", () => {
    const derivedData = { invalidate: vi.fn() };
    const searchRequests = { invalidate: vi.fn() };
    const coordinator = new WorkspaceMutationCoordinator({ derivedData, searchRequests });

    for (const filename of ["/outside/note.md", "C:outside/note.md", "../note.md", "folder/../note.md", "note.md\0x"]) {
      expect(coordinator.invalidateWatcherEvents("workspace-1", [{ eventType: "change", filename }])).toEqual({ kind: "full" });
    }
  });

  it("大量のMarkdown path eventでも対象無効化の呼出しを一度に保つ", () => {
    const derivedData = { invalidate: vi.fn() };
    const searchRequests = { invalidate: vi.fn() };
    const coordinator = new WorkspaceMutationCoordinator({ derivedData, searchRequests });
    const events = Array.from({ length: 10_000 }, (_, index) => ({
      eventType: "change",
      filename: `folder/${index}.md`
    }));

    const result = coordinator.invalidateWatcherEvents("workspace-1", events);

    expect(result).toMatchObject({ kind: "paths" });
    expect(derivedData.invalidate).toHaveBeenCalledOnce();
    expect(searchRequests.invalidate).toHaveBeenCalledOnce();
  });
});
