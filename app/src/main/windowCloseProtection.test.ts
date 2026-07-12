import { beforeEach, describe, expect, it, vi } from "vitest";

const { electronMock, ipcListeners } = vi.hoisted(() => {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    electronMock: {
      on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
        const channelListeners = listeners.get(channel) ?? new Set();
        channelListeners.add(listener);
        listeners.set(channel, channelListeners);
      }),
      removeListener: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
        listeners.get(channel)?.delete(listener);
      })
    },
    ipcListeners: listeners
  };
});

import { windowCloseRequestedChannel, windowCloseResponseChannel, type WindowCloseResponseInput } from "../shared/ipc";
import { CLOSE_CONFIRM_TIMEOUT_MS, configureWindowCloseProtection } from "./windowCloseProtection";

vi.mock("electron", () => ({
  BrowserWindow: vi.fn(),
  ipcMain: {
    on: electronMock.on,
    removeListener: electronMock.removeListener
  }
}));

function createWindow() {
  const closeHandlers: Array<(event: { preventDefault: () => void }) => void> = [];
  return {
    close: vi.fn(),
    isDestroyed: vi.fn(() => false),
    on: vi.fn((eventName: string, handler: (event: { preventDefault: () => void }) => void) => {
      if (eventName === "close") closeHandlers.push(handler);
    }),
    triggerClose: () => {
      const event = { preventDefault: vi.fn() };
      closeHandlers.forEach((handler) => handler(event));
      return event;
    },
    webContents: {
      isDestroyed: vi.fn(() => false),
      send: vi.fn()
    }
  };
}

function sendCloseResponse(input: WindowCloseResponseInput): void {
  ipcListeners.get(windowCloseResponseChannel)?.forEach((listener) => listener({}, input));
}

function sentRequestId(window: ReturnType<typeof createWindow>): string {
  return window.webContents.send.mock.calls.at(-1)?.[1].requestId as string;
}

describe("configureWindowCloseProtection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    ipcListeners.clear();
  });

  it("正常応答では承認済みcloseとしてウィンドウを閉じる", () => {
    const window = createWindow();
    configureWindowCloseProtection(window as never, () => false);

    const event = window.triggerClose();
    sendCloseResponse({ ok: true, requestId: sentRequestId(window) });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.webContents.send).toHaveBeenCalledWith(windowCloseRequestedChannel, expect.any(Object));
    expect(window.close).toHaveBeenCalledTimes(1);
    expect(electronMock.removeListener).toHaveBeenCalledWith(windowCloseResponseChannel, expect.any(Function));

    const approvedEvent = window.triggerClose();
    expect(approvedEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("キャンセル応答では閉じずに待受を解除する", () => {
    const window = createWindow();
    configureWindowCloseProtection(window as never, () => false);

    window.triggerClose();
    sendCloseResponse({ ok: false, requestId: sentRequestId(window) });

    expect(window.close).not.toHaveBeenCalled();
    expect(electronMock.removeListener).toHaveBeenCalledWith(windowCloseResponseChannel, expect.any(Function));
    expect(ipcListeners.get(windowCloseResponseChannel)?.size).toBe(0);
  });

  it("不正な終了確認応答を無視して待受を維持する", () => {
    const window = createWindow();
    configureWindowCloseProtection(window as never, () => false);

    window.triggerClose();
    ipcListeners.get(windowCloseResponseChannel)?.forEach((listener) => listener({}, undefined));

    expect(window.close).not.toHaveBeenCalled();
    expect(electronMock.removeListener).not.toHaveBeenCalled();
    expect(ipcListeners.get(windowCloseResponseChannel)?.size).toBe(1);
  });

  it("タイムアウト時に古い待受を解除し、次のclose確認を受け付ける", () => {
    const window = createWindow();
    configureWindowCloseProtection(window as never, () => false);

    window.triggerClose();
    const firstRequestId = sentRequestId(window);
    vi.advanceTimersByTime(CLOSE_CONFIRM_TIMEOUT_MS);

    expect(electronMock.removeListener).toHaveBeenCalledWith(windowCloseResponseChannel, expect.any(Function));
    expect(ipcListeners.get(windowCloseResponseChannel)?.size).toBe(0);

    window.triggerClose();
    const secondRequestId = sentRequestId(window);

    expect(secondRequestId).not.toBe(firstRequestId);
    expect(ipcListeners.get(windowCloseResponseChannel)?.size).toBe(1);
  });

  it("タイムアウト後の遅延応答ではウィンドウを閉じない", () => {
    const window = createWindow();
    configureWindowCloseProtection(window as never, () => false);

    window.triggerClose();
    const requestId = sentRequestId(window);
    vi.advanceTimersByTime(CLOSE_CONFIRM_TIMEOUT_MS);
    sendCloseResponse({ ok: true, requestId });

    expect(window.close).not.toHaveBeenCalled();
  });
});
