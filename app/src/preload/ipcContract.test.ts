import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  getPathForFile: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  send: vi.fn()
}));

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: electronMock.exposeInMainWorld
  },
  ipcRenderer: {
    invoke: electronMock.invoke,
    on: electronMock.on,
    removeListener: electronMock.removeListener,
    send: electronMock.send
  },
  webUtils: {
    getPathForFile: electronMock.getPathForFile
  }
}));

import {
  relicApiContractVersion,
  relicIpcContract,
  type IpcMethodContract,
  type RelicApi
} from "../shared/ipc";

describe("preload IPC contract", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    electronMock.getPathForFile.mockReturnValue("/tmp/Note.md");
    electronMock.invoke.mockResolvedValue({ ok: true, value: undefined });
    await import("./preload");
  });

  function exposedApi(): RelicApi {
    const api = electronMock.exposeInMainWorld.mock.calls.find(([name]) => name === "relic")?.[1];
    if (!api) throw new Error("Relic API was not exposed.");
    return api as RelicApi;
  }

  it("flatなwindow.relicへ契約バージョンと全メソッドだけを公開する", () => {
    const api = exposedApi();

    expect(api.apiContractVersion).toBe(relicApiContractVersion);
    expect(relicApiContractVersion).toBe(3);
    expect(Object.keys(api).sort()).toEqual([
      "apiContractVersion",
      ...Object.keys(relicIpcContract)
    ].sort());
  });

  it("各APIメソッドを共有契約のtransportとチャンネルへ接続する", async () => {
    const api = exposedApi() as unknown as Record<string, (...args: unknown[]) => unknown>;

    for (const [method, entry] of Object.entries(relicIpcContract)) {
      vi.clearAllMocks();
      await invokeContractMethod(api, method, entry);
    }
  });
});

async function invokeContractMethod(
  api: Record<string, (...args: unknown[]) => unknown>,
  method: string,
  entry: IpcMethodContract
): Promise<void> {
  const operation = api[method];
  expect(operation, method).toBeTypeOf("function");

  if (entry.transport === "invoke") {
    if (entry.validatesInput) {
      await operation(undefined);
      expect(electronMock.invoke).toHaveBeenCalledWith(entry.channel, undefined);
    } else {
      await operation();
      expect(electronMock.invoke).toHaveBeenCalledWith(entry.channel);
    }
    return;
  }

  if (entry.transport === "send") {
    operation(undefined);
    expect(electronMock.send).toHaveBeenCalledWith(entry.channel, undefined);
    return;
  }

  if (entry.transport === "subscribe") {
    const unsubscribe = operation(vi.fn());
    expect(electronMock.on).toHaveBeenCalledWith(entry.channel, expect.any(Function));
    expect(unsubscribe).toBeTypeOf("function");
    (unsubscribe as () => void)();
    expect(electronMock.removeListener).toHaveBeenCalledWith(entry.channel, expect.any(Function));
    return;
  }

  const file = new File([""], "Note.md");
  expect(operation(file)).toBe("/tmp/Note.md");
  expect(electronMock.getPathForFile).toHaveBeenCalledWith(file);
}
