import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  handle: vi.fn(),
  on: vi.fn(),
  startDrag: vi.fn()
}));

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn().mockReturnValue("/tmp/relic-contract"),
    getVersion: vi.fn().mockReturnValue("0.0.0")
  },
  BrowserWindow: class BrowserWindow {
    static fromWebContents = vi.fn().mockReturnValue(null);
  },
  clipboard: {
    readText: vi.fn().mockReturnValue(""),
    writeText: vi.fn()
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
  },
  ipcMain: {
    handle: electronMock.handle,
    on: electronMock.on,
    removeListener: vi.fn()
  },
  nativeImage: {
    createFromDataURL: vi.fn(),
    createFromPath: vi.fn()
  },
  shell: {
    openPath: vi.fn(),
    showItemInFolder: vi.fn(),
    trashItem: vi.fn()
  }
}));

vi.mock("../i18n", () => ({
  getMainTranslator: vi.fn().mockResolvedValue((key: string) => key)
}));

import { relicIpcContract } from "../../shared/ipc";
import { registerAppHandlers } from "./appHandlers";
import { isWindowCloseResponseInput } from "./editorHandlerValidators";
import { registerEditorHandlers } from "./editorHandlers";
import { registerFileHandlers } from "./fileHandlers";
import { registerOutputHandlers } from "./outputHandlers";
import { registerToolHandlers } from "./toolHandlers";
import { registerWorkspaceHandlers } from "./workspaceHandlers";

type RegisteredHandler = (event: unknown, input?: unknown) => unknown;

function registerAllHandlers(): void {
  registerAppHandlers();
  registerEditorHandlers();
  registerFileHandlers();
  registerOutputHandlers();
  registerToolHandlers();
  registerWorkspaceHandlers();
}

function registeredHandler(channel: string): RegisteredHandler {
  const handler = electronMock.handle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1];
  if (!handler) throw new Error(`Handler was not registered: ${channel}`);
  return handler as RegisteredHandler;
}

describe("IPC handler contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerAllHandlers();
  });

  it("共有契約にあるhandleとonを重複なくすべて登録する", () => {
    const expectedHandleChannels = Object.values(relicIpcContract)
      .filter((entry) => entry.main === "handle")
      .map((entry) => entry.channel)
      .sort();
    const expectedOnChannels = Object.values(relicIpcContract)
      .filter((entry) => entry.main === "on")
      .map((entry) => entry.channel)
      .sort();
    const actualHandleChannels = electronMock.handle.mock.calls.map(([channel]) => channel).sort();
    const actualOnChannels = electronMock.on.mock.calls.map(([channel]) => channel).sort();

    expect(actualHandleChannels).toEqual(expectedHandleChannels);
    expect(actualOnChannels).toEqual(expectedOnChannels);
    expect(new Set(actualHandleChannels).size).toBe(actualHandleChannels.length);
    expect(new Set(actualOnChannels).size).toBe(actualOnChannels.length);
  });

  it("入力検証が必要なhandleは不正入力をメイン処理へ渡さず拒否する", async () => {
    const validatedEntries = Object.values(relicIpcContract)
      .filter((entry) => entry.main === "handle" && entry.validatesInput);

    for (const entry of validatedEntries) {
      if (!entry.channel) throw new Error("Validated IPC entry must have a channel.");
      const result = await registeredHandler(entry.channel)({}, undefined);
      expect(result, entry.channel).toMatchObject({
        error: { code: expect.stringContaining("INVALID") },
        ok: false
      });
    }
  });

  it("sendで受け取るファイルドラッグも不正入力ではOS操作を開始しない", () => {
    const entry = relicIpcContract.startWorkspaceFileDrag;
    const listener = electronMock.on.mock.calls.find(([channel]) => channel === entry.channel)?.[1] as RegisteredHandler | undefined;
    if (!listener) throw new Error("File drag listener was not registered.");

    listener({ sender: { startDrag: electronMock.startDrag } }, undefined);

    expect(electronMock.startDrag).not.toHaveBeenCalled();
  });

  it("ウィンドウ終了ライフサイクルの応答にも共有契約どおり入力検証を要求する", () => {
    const entry = relicIpcContract.respondToWindowCloseRequest;

    expect(entry).toMatchObject({ main: "lifecycle", validatesInput: true });
    expect(isWindowCloseResponseInput(undefined)).toBe(false);
    expect(isWindowCloseResponseInput({ ok: true, requestId: "close-1" })).toBe(true);
  });
});
