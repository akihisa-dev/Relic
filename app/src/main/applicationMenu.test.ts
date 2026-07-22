import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => {
  const items = new Map<string, { checked: boolean; enabled: boolean }>();
  const menu = {
    getMenuItemById: vi.fn((id: string) => items.get(id))
  };

  return {
    buildFromTemplate: vi.fn(() => menu),
    currentMenu: menu,
    getApplicationMenu: vi.fn(() => menu),
    items,
    on: vi.fn(),
    setApplicationMenu: vi.fn()
  };
});

vi.mock("electron", () => ({
  ipcMain: { on: electronMock.on },
  Menu: {
    buildFromTemplate: electronMock.buildFromTemplate,
    getApplicationMenu: electronMock.getApplicationMenu,
    setApplicationMenu: electronMock.setApplicationMenu
  }
}));

import type { ApplicationMenuState } from "../shared/ipc";
import type { Translator } from "../shared/i18n";
import {
  buildApplicationMenuTemplate,
  configureApplicationMenu,
  defaultApplicationMenuState,
  isApplicationMenuState,
  registerApplicationMenuStateHandler
} from "./applicationMenu";

describe("application menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.items.clear();
  });

  it("macOS標準構成とRelic固有ショートカットを定義する", () => {
    const template = buildApplicationMenuTemplate(
      ((key: string) => key) as Translator,
      vi.fn(),
      vi.fn()
    );

    expect(template.map((item) => item.label)).toEqual([
      "Relic",
      "menu.file",
      "menu.edit",
      "menu.view",
      "menu.window"
    ]);
    expect(findItem(template, "application-menu-close-tab")).toMatchObject({
      accelerator: "CommandOrControl+W",
      label: "menu.closeTab"
    });
    expect(findItem(template, "application-menu-split")).toMatchObject({
      accelerator: "CommandOrControl+\\",
      type: "checkbox"
    });
    expect(findItemByLabel(template, "menu.closeWindow")).toMatchObject({
      accelerator: "CommandOrControl+Shift+W"
    });
    expect(findItemByRole(template, "quit")).toBeDefined();
    expect(findItemByRole(template, "services")).toBeDefined();
  });

  it("Rendererから受け取る状態を完全な真偽値オブジェクトに限定する", () => {
    expect(isApplicationMenuState(defaultApplicationMenuState)).toBe(true);
    expect(isApplicationMenuState({ ...defaultApplicationMenuState, unexpected: true })).toBe(false);
    expect(isApplicationMenuState({ ...defaultApplicationMenuState, isSplit: "yes" })).toBe(false);
    expect(isApplicationMenuState(null)).toBe(false);
  });

  it("現在のメインウインドウから受け取った状態だけをメニューへ反映する", () => {
    for (const id of [
      "application-menu-close-tab",
      "application-menu-reopen-closed-tab",
      "application-menu-right-panel",
      "application-menu-sidebar",
      "application-menu-split",
      "application-menu-typewriter"
    ]) {
      electronMock.items.set(id, { checked: false, enabled: false });
    }
    const webContents = { isDestroyed: () => false, send: vi.fn() };
    const window = { close: vi.fn(), isDestroyed: () => false, webContents };
    configureApplicationMenu(() => window as never);
    registerApplicationMenuStateHandler();
    const listener = electronMock.on.mock.calls.at(-1)?.[1] as (
      event: { sender: unknown },
      state: ApplicationMenuState
    ) => void;
    const state: ApplicationMenuState = {
      canCloseTab: true,
      canReopenClosedTab: true,
      canToggleRightPanel: true,
      isRightPanelOpen: true,
      isSidebarOpen: false,
      isSplit: true,
      isTypewriterMode: true
    };

    listener({ sender: {} }, state);
    expect(electronMock.items.get("application-menu-close-tab")?.enabled).toBe(false);

    listener({ sender: webContents }, state);
    expect(electronMock.items.get("application-menu-close-tab")?.enabled).toBe(true);
    expect(electronMock.items.get("application-menu-reopen-closed-tab")?.enabled).toBe(true);
    expect(electronMock.items.get("application-menu-right-panel")).toEqual({ checked: true, enabled: true });
    expect(electronMock.items.get("application-menu-sidebar")?.checked).toBe(false);
    expect(electronMock.items.get("application-menu-split")?.checked).toBe(true);
    expect(electronMock.items.get("application-menu-typewriter")?.checked).toBe(true);
  });
});

function findItem(template: Electron.MenuItemConstructorOptions[], id: string): Electron.MenuItemConstructorOptions | undefined {
  return flattenMenu(template).find((item) => item.id === id);
}

function findItemByLabel(
  template: Electron.MenuItemConstructorOptions[],
  label: string
): Electron.MenuItemConstructorOptions | undefined {
  return flattenMenu(template).find((item) => item.label === label);
}

function findItemByRole(
  template: Electron.MenuItemConstructorOptions[],
  role: Electron.MenuItemConstructorOptions["role"]
): Electron.MenuItemConstructorOptions | undefined {
  return flattenMenu(template).find((item) => item.role === role);
}

function flattenMenu(template: Electron.MenuItemConstructorOptions[]): Electron.MenuItemConstructorOptions[] {
  return template.flatMap((item) => [
    item,
    ...(Array.isArray(item.submenu) ? flattenMenu(item.submenu) : [])
  ]);
}
