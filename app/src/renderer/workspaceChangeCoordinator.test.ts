import { describe, expect, it } from "vitest";

import { WorkspaceChangeCoordinator } from "./workspaceChangeCoordinator";

describe("WorkspaceChangeCoordinator", () => {
  it("active workspaceのrevisionを単調に受理し、古い通知を無視する", () => {
    const coordinator = new WorkspaceChangeCoordinator();
    const event = (revision: number) => ({
      changedAt: "2026-01-01T00:00:00.000Z",
      kind: "paths" as const,
      paths: ["note.md"],
      revision,
      workspaceId: "ws-1"
    });

    expect(coordinator.accept(event(2), "ws-1")).toMatchObject({ kind: "paths", revision: 2 });
    expect(coordinator.accept(event(1), "ws-1")).toBeNull();
    expect(coordinator.accept(event(2), "ws-1")).toBeNull();
    expect(coordinator.accept({
      changedAt: "2026-01-01T00:00:00.000Z",
      kind: "full",
      revision: 3,
      workspaceId: "ws-1"
    }, "ws-1")).toMatchObject({ kind: "full", revision: 3 });
  });

  it("別workspaceの通知はrevisionだけ記録し、現在画面へ適用しない", () => {
    const coordinator = new WorkspaceChangeCoordinator();
    expect(coordinator.accept({
      changedAt: "2026-01-01T00:00:00.000Z",
      kind: "full",
      revision: 10,
      workspaceId: "ws-2"
    }, "ws-1")).toBeNull();
    expect(coordinator.accept({
      changedAt: "2026-01-01T00:00:00.000Z",
      kind: "full",
      revision: 9,
      workspaceId: "ws-2"
    }, "ws-2")).toBeNull();
    expect(coordinator.accept({
      changedAt: "2026-01-01T00:00:00.000Z",
      kind: "full",
      revision: 11,
      workspaceId: "ws-2"
    }, "ws-2")).toMatchObject({ kind: "full", revision: 11 });
  });

  it("Rendererへ届いた危険なpathはfullへ退避する", () => {
    const coordinator = new WorkspaceChangeCoordinator();
    expect(coordinator.accept({
      changedAt: "2026-01-01T00:00:00.000Z",
      kind: "paths",
      paths: ["../outside.md"],
      revision: 1,
      workspaceId: "ws-1"
    }, "ws-1")).toMatchObject({ kind: "full", revision: 1 });
  });

  it("Markdown以外のpaths通知はfullへ退避する", () => {
    const coordinator = new WorkspaceChangeCoordinator();
    expect(coordinator.accept({
      changedAt: "2026-01-01T00:00:00.000Z",
      kind: "paths",
      paths: ["assets/image.png"],
      revision: 1,
      workspaceId: "ws-1"
    }, "ws-1")).toMatchObject({ kind: "full", revision: 1 });
  });
});
