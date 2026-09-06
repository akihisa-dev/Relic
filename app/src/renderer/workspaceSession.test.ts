import { describe, expect, it } from "vitest";

import { makeWorkspaceState } from "../test/rendererTestUtils";
import { WorkspaceSession } from "./workspaceSession";

describe("WorkspaceSession", () => {
  it("切替の通知前に旧要求を無効化し、IDと世代を一緒に公開する", () => {
    const session = new WorkspaceSession(makeWorkspaceState("a"));
    const isCurrent = session.beginWorkspaceRequestFor("a");
    const notifications: unknown[] = [];
    session.subscribe(() => notifications.push({
      current: isCurrent(),
      id: session.getSnapshot().workspaceState?.activeWorkspace?.id,
      revision: session.getSnapshot().workspaceDataRevision
    }));

    session.setWorkspaceState(makeWorkspaceState("b"));

    expect(notifications).toEqual([{ current: false, id: "b", revision: 1 }]);
    expect(session.beginWorkspaceRequestFor("a")()).toBe(false);
  });

  it("切替先を予約した後に開始した要求はsnapshot反映で再無効化しない", () => {
    const session = new WorkspaceSession(makeWorkspaceState("a"));
    session.invalidateWorkspaceRequests("b");
    const isCurrent = session.beginWorkspaceRequestFor("b");

    session.setWorkspaceState(makeWorkspaceState("b"));

    expect(isCurrent()).toBe(true);
    expect(session.getSnapshot().workspaceDataRevision).toBe(1);
  });

  it("同じワークスペースへ戻った場合も以前の要求と別世代にする", () => {
    const session = new WorkspaceSession(makeWorkspaceState("a"));
    const oldRequest = session.beginWorkspaceRequestFor("a");
    session.setWorkspaceState(makeWorkspaceState("b"));
    session.setWorkspaceState(makeWorkspaceState("a"));

    expect(oldRequest()).toBe(false);
    expect(session.getSnapshot().workspaceDataRevision).toBe(2);
    expect(session.getSnapshot().workspaceStructureRevision).toBe(2);
  });

  it("起動後の初回読込を基準世代とし、同じworkspaceのsnapshot更新では世代を進めない", () => {
    const session = new WorkspaceSession();
    session.setWorkspaceState(makeWorkspaceState("a"));
    const current = session.beginWorkspaceRequestFor("a");
    session.setWorkspaceState(makeWorkspaceState("a"));

    expect(current()).toBe(true);
    expect(session.getSnapshot().workspaceDataRevision).toBe(0);
  });

  it("本文変更と構造変更の世代を分け、データ変更で操作要求を取り消さない", () => {
    const session = new WorkspaceSession(makeWorkspaceState("a"));
    const current = session.beginWorkspaceRequestFor("a");
    session.markWorkspaceDataChanged("paths");
    expect(session.getSnapshot()).toMatchObject({ workspaceDataRevision: 1, workspaceStructureRevision: 0 });
    session.markWorkspaceDataChanged();
    expect(session.getSnapshot()).toMatchObject({ workspaceDataRevision: 2, workspaceStructureRevision: 1 });
    expect(current()).toBe(true);
  });

  it("登録解除から再選択した場合も要求と派生データを更新する", () => {
    const session = new WorkspaceSession(makeWorkspaceState("a"));
    session.setWorkspaceState(makeWorkspaceState(null));
    const emptyRequest = session.beginWorkspaceRequestFor(null);
    session.setWorkspaceState(makeWorkspaceState("a"));
    expect(emptyRequest()).toBe(false);
    expect(session.getSnapshot().workspaceDataRevision).toBe(2);
  });
});
