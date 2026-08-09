import { beforeEach, describe, expect, it, vi } from "vitest";

const settingsMock = vi.hoisted(() => ({
  readAppSettings: vi.fn()
}));

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/relic-user-data") }
}));

vi.mock("../settings/appSettings", () => ({
  readAppSettings: settingsMock.readAppSettings
}));

import { ipcErrorDetails, getRegisteredWorkspaceContext } from "./activeWorkspace";

const workspaceA = { id: "workspace-a", name: "A", path: "/workspace-a" };
const workspaceB = { id: "workspace-b", name: "B", path: "/workspace-b" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ipcErrorDetails", () => {
  it("redacts sensitive values from Error messages", () => {
    expect(ipcErrorDetails(new Error(`failed ${["sk", "abcdefghijklmnopqrstuvwxyz"].join("-")} in C:\\Users\\alice\\secret.md`))).toBe(
      "failed sk-[redacted] in [path redacted]"
    );
  });

  it("keeps normal error messages unchanged", () => {
    expect(ipcErrorDetails(new Error("設定を読み込めませんでした。"))).toBe("設定を読み込めませんでした。");
  });

  it("安全でないworkspaceIdは設定読込前に拒否する", async () => {
    const result = await getRegisteredWorkspaceContext("../outside");

    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_WORKSPACE_ID" } });
    expect(settingsMock.readAppSettings).not.toHaveBeenCalled();
  });

  it("アクティブでない登録済みworkspaceも明示IDで解決する", async () => {
    settingsMock.readAppSettings.mockResolvedValue({
      editorSettings: {},
      frontmatterTemplates: [],
      lastWorkspaceId: workspaceB.id,
      userDefinedFields: [],
      workspaces: [workspaceA, workspaceB]
    });

    const result = await getRegisteredWorkspaceContext(workspaceA.id);

    expect(result).toEqual({
      ok: true,
      value: {
        settings: expect.objectContaining({ lastWorkspaceId: workspaceB.id }),
        userDataPath: "/tmp/relic-user-data",
        workspace: workspaceA
      }
    });
  });

  it("未登録workspaceIdは保存対象として解決しない", async () => {
    settingsMock.readAppSettings.mockResolvedValue({
      editorSettings: {},
      frontmatterTemplates: [],
      lastWorkspaceId: workspaceB.id,
      userDefinedFields: [],
      workspaces: [workspaceB]
    });

    const result = await getRegisteredWorkspaceContext(workspaceA.id);

    expect(result).toMatchObject({ ok: false, error: { code: "WORKSPACE_NOT_FOUND" } });
  });
});
