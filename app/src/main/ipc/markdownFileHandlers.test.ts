import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  getAppPath: vi.fn(),
  getPath: vi.fn(),
  handle: vi.fn(),
  isEmpty: vi.fn(),
  on: vi.fn(),
  createFromDataURL: vi.fn(),
  createFromPath: vi.fn(),
  showItemInFolder: vi.fn()
}));

vi.mock("electron", () => ({
  app: {
    getAppPath: electronMock.getAppPath,
    getPath: electronMock.getPath
  },
  ipcMain: {
    handle: electronMock.handle,
    on: electronMock.on
  },
  nativeImage: {
    createFromDataURL: electronMock.createFromDataURL,
    createFromPath: electronMock.createFromPath
  },
  shell: { showItemInFolder: electronMock.showItemInFolder }
}));

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  revealWorkspaceItemChannel
} from "../../shared/ipc";
import { writeAppSettings } from "../settings/appSettings";
import { addOrActivateWorkspace, createWorkspaceSummary } from "../workspace/workspaceService";
import { registerMarkdownFileHandlers } from "./markdownFileHandlers";

describe("markdownFileHandlers", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    vi.clearAllMocks();
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  beforeEach(() => {
    const icon = { isEmpty: electronMock.isEmpty };
    electronMock.createFromDataURL.mockReturnValue(icon);
    electronMock.createFromPath.mockReturnValue(icon);
    electronMock.getAppPath.mockReturnValue("/tmp/relic-app");
    electronMock.isEmpty.mockReturnValue(false);
  });

  it("場所表示ではワークスペース外を指すシンボリックリンクを開かない", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    const outsidePath = await mkdtemp(path.join(os.tmpdir(), "relic-outside-"));
    temporaryPaths.push(userDataPath, workspacePath, outsidePath);

    await mkdir(path.join(workspacePath, "links"));
    await writeFile(path.join(outsidePath, "secret.md"), "# Outside\n", "utf8");
    await symlink(path.join(outsidePath, "secret.md"), path.join(workspacePath, "links", "secret.md"));

    const workspace = createWorkspaceSummary(workspacePath);
    const settings = addOrActivateWorkspace(
      {
        editorSettings: defaultEditorSettings,
        featureToggles: defaultFeatureToggles,
        frontmatterTemplates: defaultFrontmatterTemplates,
        lastWorkspaceId: null,
        userDefinedFields: [],
        workspaces: []
      },
      workspace
    );
    await writeAppSettings(userDataPath, settings);

    electronMock.getPath.mockReturnValue(userDataPath);
    registerMarkdownFileHandlers();
    const revealHandler = electronMock.handle.mock.calls.find(
      ([channel]) => channel === revealWorkspaceItemChannel
    )?.[1];

    if (!revealHandler) throw new Error("reveal workspace item handler was not registered");

    const result = await revealHandler(undefined, { path: "links/secret.md" });

    expect(result).toMatchObject({
      error: { code: "WORKSPACE_PATH_OUTSIDE" },
      ok: false
    });
    expect(electronMock.showItemInFolder).not.toHaveBeenCalled();
  });
});
