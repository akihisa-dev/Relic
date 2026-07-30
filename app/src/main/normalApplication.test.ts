import { describe, expect, it, vi } from "vitest";

import { createNormalApplicationInitializer, isCurrentMainWindowSender } from "./normalApplication";

describe("normalApplication", () => {
  it("IPC・handler・menuを一度だけ初期化する", () => {
    const configureApplicationMenu = vi.fn();
    const configureIpcSenderAuthorization = vi.fn();
    const registerHandlers = [vi.fn(), vi.fn(), vi.fn()];
    const getMainWindow = vi.fn(() => null);
    const initialize = createNormalApplicationInitializer(getMainWindow, {
      configureApplicationMenu,
      configureIpcSenderAuthorization,
      registerHandlers
    });

    initialize();
    initialize();

    expect(configureIpcSenderAuthorization).toHaveBeenCalledOnce();
    registerHandlers.forEach((register) => expect(register).toHaveBeenCalledOnce());
    expect(configureApplicationMenu).toHaveBeenCalledOnce();
    expect(configureApplicationMenu).toHaveBeenCalledWith(getMainWindow);
  });

  it("現在の破棄されていないMain windowだけをIPC senderとして許可する", () => {
    const sender = { isDestroyed: vi.fn(() => false) } as unknown as Electron.WebContents;
    const window = {
      isDestroyed: vi.fn(() => false),
      webContents: sender
    } as unknown as Electron.BrowserWindow;

    expect(isCurrentMainWindowSender(window, sender)).toBe(true);
    expect(isCurrentMainWindowSender(window, {} as Electron.WebContents)).toBe(false);
    expect(isCurrentMainWindowSender(null, sender)).toBe(false);

    window.isDestroyed = vi.fn(() => true);
    expect(isCurrentMainWindowSender(window, sender)).toBe(false);
  });
});
