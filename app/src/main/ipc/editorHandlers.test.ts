import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  clipboardReadText: vi.fn(),
  clipboardWriteText: vi.fn(),
  getPath: vi.fn(),
  handle: vi.fn(),
  refreshApplicationMenu: vi.fn()
}));

vi.mock("electron", () => ({
  app: { getPath: electronMock.getPath },
  clipboard: {
    readText: electronMock.clipboardReadText,
    writeText: electronMock.clipboardWriteText
  },
  ipcMain: { handle: electronMock.handle }
}));

vi.mock("../applicationMenu", () => ({
  refreshApplicationMenu: electronMock.refreshApplicationMenu
}));

import {
  copyEditorTextToClipboardChannel,
  defaultEditorSettings,
  defaultFeatureToggles,
  defaultFrontmatterTemplates,
  getEditorSettingsChannel,
  listFileRecoverySnapshotsChannel,
  readEditorTextFromClipboardChannel,
  readFileRecoverySnapshotChannel,
  saveEditorSettingsChannel,
  writeMarkdownFileChannel
} from "../../shared/ipc";
import { workspaceMutationCoordinator } from "../files/workspaceDataInvalidation";
import { readAppSettings, writeAppSettings } from "../settings/appSettings";
import { addOrActivateWorkspace, createWorkspaceSummary } from "../workspace/workspaceService";
import { registerEditorHandlers } from "./editorHandlers";

describe("editor IPC handlers", () => {
  const temporaryPaths: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.getPath.mockReturnValue("/tmp/relic-user-data");
    registerEditorHandlers();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(temporaryPaths.splice(0).map((temporaryPath) => rm(temporaryPath, {
      force: true,
      recursive: true
    })));
  });

  function handlerFor(channel: string): (event?: unknown, input?: unknown) => Promise<unknown> {
    const handler = electronMock.handle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1];
    if (!handler) throw new Error(`${channel} handler was not registered.`);
    return handler;
  }

  it("エディタ貼り付け用途のクリップボード読み取りハンドラを登録する", async () => {
    electronMock.clipboardReadText.mockReturnValue("pasted");

    const result = await handlerFor(readEditorTextFromClipboardChannel)({});

    expect(result).toEqual({ ok: true, value: "pasted" });
    expect(electronMock.clipboardReadText).toHaveBeenCalled();
  });

  it("エディタコピー用途のテキストだけを書き込む", async () => {
    const result = await handlerFor(copyEditorTextToClipboardChannel)({}, { text: "selected" });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(electronMock.clipboardWriteText).toHaveBeenCalledWith("selected");
  });

  it("空文字と大きすぎるテキストは書き込まない", async () => {
    const emptyResult = await handlerFor(copyEditorTextToClipboardChannel)({}, { text: "" });
    const largeResult = await handlerFor(copyEditorTextToClipboardChannel)({}, { text: "x".repeat(1_000_001) });

    expect(emptyResult).toEqual(expect.objectContaining({
      error: expect.objectContaining({ code: "EDITOR_CLIPBOARD_INVALID_INPUT" }),
      ok: false
    }));
    expect(largeResult).toEqual(expect.objectContaining({
      error: expect.objectContaining({ code: "EDITOR_CLIPBOARD_INVALID_INPUT" }),
      ok: false
    }));
    expect(electronMock.clipboardWriteText).not.toHaveBeenCalled();
  });

  it("大きすぎる貼り付けテキストは読み取り結果として返さない", async () => {
    electronMock.clipboardReadText.mockReturnValue("x".repeat(1_000_001));

    const result = await handlerFor(readEditorTextFromClipboardChannel)({});

    expect(result).toEqual(expect.objectContaining({
      error: expect.objectContaining({ code: "EDITOR_CLIPBOARD_INVALID_INPUT" }),
      ok: false
    }));
  });

  it("Markdown保存を現在のワークスペースへ接続し、更新前の復元版を読み戻せる", async () => {
    const { userDataPath, workspace, workspacePath } = await createActiveWorkspace({
      "Note.md": "# Before"
    });
    const invalidateSpy = vi.spyOn(workspaceMutationCoordinator, "invalidateAfterMutation");

    const writeResult = await handlerFor(writeMarkdownFileChannel)(undefined, {
      content: "# After",
      expectedContent: "# Before",
      path: "Note.md"
    });

    expect(writeResult).toEqual({ ok: true, value: undefined });
    await expect(readFile(path.join(workspacePath, "Note.md"), "utf8")).resolves.toBe("# After");
    expect(invalidateSpy).toHaveBeenCalledWith(workspace.id, ["Note.md"]);

    const listResult = await handlerFor(listFileRecoverySnapshotsChannel)(undefined, {
      path: "Note.md"
    });
    const entries = successfulValue<Array<{ id: string }>>(listResult);
    expect(entries).toHaveLength(1);

    const readResult = await handlerFor(readFileRecoverySnapshotChannel)(undefined, {
      path: "Note.md",
      snapshotId: entries[0]!.id
    });
    expect(readResult).toMatchObject({
      ok: true,
      value: {
        content: "# Before",
        path: "Note.md",
        workspaceId: workspace.id
      }
    });
    expect(electronMock.getPath).toHaveBeenCalledWith("userData");
    expect(userDataPath).not.toBe(workspacePath);
  });

  it("保存競合時はファイルと派生データを変更しない", async () => {
    const { workspacePath } = await createActiveWorkspace({
      "Note.md": "# Current"
    });
    const invalidateSpy = vi.spyOn(workspaceMutationCoordinator, "invalidateAfterMutation");

    const result = await handlerFor(writeMarkdownFileChannel)(undefined, {
      content: "# Overwrite",
      expectedContent: "# Stale",
      path: "Note.md"
    });

    expect(result).toMatchObject({
      error: { code: "FILE_WRITE_CONFLICT" },
      ok: false
    });
    await expect(readFile(path.join(workspacePath, "Note.md"), "utf8")).resolves.toBe("# Current");
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("エディタ設定を読み書きし、保存後にメニューを更新する", async () => {
    const { userDataPath } = await createActiveWorkspace({});
    const nextSettings = {
      ...defaultEditorSettings,
      fontSize: 19,
      language: "en" as const
    };

    const initialResult = await handlerFor(getEditorSettingsChannel)();
    expect(initialResult).toEqual({ ok: true, value: defaultEditorSettings });

    const saveResult = await handlerFor(saveEditorSettingsChannel)(undefined, nextSettings);

    expect(saveResult).toEqual({ ok: true, value: undefined });
    await expect(readAppSettings(userDataPath)).resolves.toMatchObject({
      editorSettings: nextSettings
    });
    expect(electronMock.refreshApplicationMenu).toHaveBeenCalledTimes(1);
  });

  it.each([
    [writeMarkdownFileChannel, { content: "x", path: "" }, "FILE_WRITE_INVALID_INPUT"],
    [listFileRecoverySnapshotsChannel, { path: "" }, "FILE_RECOVERY_INVALID_INPUT"],
    [readFileRecoverySnapshotChannel, { path: "Note.md", snapshotId: "../outside" }, "FILE_RECOVERY_INVALID_INPUT"],
    [saveEditorSettingsChannel, { language: "unknown" }, "EDITOR_SETTINGS_INVALID"]
  ])("不正入力を副作用なしで拒否する: %s", async (channel, input, code) => {
    const result = await handlerFor(channel)(undefined, input);

    expect(result).toMatchObject({
      error: { code },
      ok: false
    });
    expect(electronMock.refreshApplicationMenu).not.toHaveBeenCalled();
  });

  async function createActiveWorkspace(files: Record<string, string>): Promise<{
    userDataPath: string;
    workspace: ReturnType<typeof createWorkspaceSummary>;
    workspacePath: string;
  }> {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-user-data-"));
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-workspace-"));
    temporaryPaths.push(userDataPath, workspacePath);

    await Promise.all(Object.entries(files).map(([relativePath, content]) =>
      writeFile(path.join(workspacePath, relativePath), content, "utf8")
    ));

    const workspace = createWorkspaceSummary(workspacePath);
    await writeAppSettings(userDataPath, addOrActivateWorkspace({
      editorSettings: defaultEditorSettings,
      featureToggles: defaultFeatureToggles,
      frontmatterTemplates: defaultFrontmatterTemplates,
      lastWorkspaceId: null,
      userDefinedFields: [],
      workspaces: []
    }, workspace));
    electronMock.getPath.mockReturnValue(userDataPath);
    return { userDataPath, workspace, workspacePath };
  }
});

function successfulValue<T>(result: unknown): T {
  if (
    typeof result !== "object"
    || result === null
    || !("ok" in result)
    || result.ok !== true
    || !("value" in result)
  ) {
    throw new Error("Expected successful result");
  }
  return result.value as T;
}
