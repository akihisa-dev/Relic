import { Menu, ipcMain, type BrowserWindow, type MenuItemConstructorOptions } from "electron";

import {
  applicationMenuCommandChannel,
  updateApplicationMenuStateChannel,
  type ApplicationMenuCommand,
  type ApplicationMenuState
} from "../shared/ipc";
import type { Translator } from "../shared/i18n";
import { getCachedMainTranslator } from "./i18n";

const menuItemIds = {
  closeTab: "application-menu-close-tab",
  reopenClosedTab: "application-menu-reopen-closed-tab",
  rightPanel: "application-menu-right-panel",
  sidebar: "application-menu-sidebar",
  split: "application-menu-split",
  typewriter: "application-menu-typewriter"
} as const;

export const defaultApplicationMenuState: ApplicationMenuState = {
  canCloseTab: false,
  canReopenClosedTab: false,
  canToggleRightPanel: false,
  isRightPanelOpen: false,
  isSidebarOpen: true,
  isSplit: false,
  isTypewriterMode: false
};

let currentState = defaultApplicationMenuState;
let mainWindowProvider: () => BrowserWindow | null = () => null;

export function configureApplicationMenu(getMainWindow: () => BrowserWindow | null): void {
  mainWindowProvider = getMainWindow;
  refreshApplicationMenu();
}

export function registerApplicationMenuStateHandler(): void {
  ipcMain.on(updateApplicationMenuStateChannel, (event, input: unknown) => {
    const window = mainWindowProvider();
    if (!window || window.isDestroyed() || event.sender !== window.webContents) return;
    if (!isApplicationMenuState(input)) return;

    currentState = input;
    applyApplicationMenuState(input);
  });
}

export function refreshApplicationMenu(): void {
  const menu = Menu.buildFromTemplate(buildApplicationMenuTemplate(
    getCachedMainTranslator(),
    dispatchApplicationMenuCommand,
    closeMainWindow
  ));
  Menu.setApplicationMenu(menu);
  applyApplicationMenuState(currentState);
}

export function isApplicationMenuState(input: unknown): input is ApplicationMenuState {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const state = input as Record<string, unknown>;
  const keys = Object.keys(defaultApplicationMenuState);

  return Object.keys(state).length === keys.length
    && keys.every((key) => typeof state[key] === "boolean");
}

export function buildApplicationMenuTemplate(
  t: Translator,
  dispatch: (command: ApplicationMenuCommand) => void,
  closeWindow: () => void
): MenuItemConstructorOptions[] {
  const command = (
    label: string,
    commandId: ApplicationMenuCommand,
    options: Pick<MenuItemConstructorOptions, "accelerator" | "id" | "type"> = {}
  ): MenuItemConstructorOptions => ({
    ...options,
    click: () => dispatch(commandId),
    label
  });

  return [
    {
      label: "Relic",
      submenu: [
        { label: t("menu.about"), role: "about" },
        { type: "separator" },
        command(t("menu.settings"), "open-settings", { accelerator: "CommandOrControl+," }),
        { type: "separator" },
        { label: t("menu.services"), role: "services", submenu: [] },
        { type: "separator" },
        { label: t("menu.hide"), role: "hide" },
        { label: t("menu.hideOthers"), role: "hideOthers" },
        { label: t("menu.showAll"), role: "unhide" },
        { type: "separator" },
        { label: t("menu.quit"), role: "quit" }
      ]
    },
    {
      label: t("menu.file"),
      submenu: [
        command(t("menu.newNote"), "new-note", { accelerator: "CommandOrControl+N" }),
        { type: "separator" },
        command(t("menu.closeTab"), "close-tab", {
          accelerator: "CommandOrControl+W",
          id: menuItemIds.closeTab
        }),
        command(t("menu.reopenClosedTab"), "reopen-closed-tab", {
          accelerator: "CommandOrControl+Shift+T",
          id: menuItemIds.reopenClosedTab
        })
      ]
    },
    {
      label: t("menu.edit"),
      submenu: [
        { label: t("editor.undo"), role: "undo" },
        { label: t("editor.redo"), role: "redo" },
        { type: "separator" },
        { label: t("editor.cut"), role: "cut" },
        { label: t("editor.copy"), role: "copy" },
        { label: t("editor.paste"), role: "paste" },
        { label: t("menu.pasteAndMatchStyle"), role: "pasteAndMatchStyle" },
        { label: t("menu.delete"), role: "delete" },
        { label: t("editor.selectAll"), role: "selectAll" },
        { type: "separator" },
        {
          label: t("menu.substitutions"),
          submenu: [
            { label: t("menu.showSubstitutions"), role: "showSubstitutions" },
            { label: t("menu.smartQuotes"), role: "toggleSmartQuotes" },
            { label: t("menu.smartDashes"), role: "toggleSmartDashes" },
            { label: t("menu.textReplacement"), role: "toggleTextReplacement" }
          ]
        },
        {
          label: t("menu.speech"),
          submenu: [
            { label: t("menu.startSpeaking"), role: "startSpeaking" },
            { label: t("menu.stopSpeaking"), role: "stopSpeaking" }
          ]
        }
      ]
    },
    {
      label: t("menu.view"),
      submenu: [
        command(t("command.search"), "open-search", { accelerator: "CommandOrControl+F" }),
        command(t("command.quickSwitcher"), "open-quick-switcher", { accelerator: "CommandOrControl+P" }),
        command(t("command.palette"), "open-command-palette", { accelerator: "CommandOrControl+Shift+P" }),
        { type: "separator" },
        command(t("command.sidebar"), "toggle-sidebar", {
          accelerator: "CommandOrControl+B",
          id: menuItemIds.sidebar,
          type: "checkbox"
        }),
        command(t("command.split"), "toggle-split", {
          accelerator: "CommandOrControl+\\",
          id: menuItemIds.split,
          type: "checkbox"
        }),
        command(t("command.rightPanel"), "toggle-right-panel", {
          accelerator: "CommandOrControl+Shift+B",
          id: menuItemIds.rightPanel,
          type: "checkbox"
        }),
        command(t("command.typewriter"), "toggle-typewriter", {
          id: menuItemIds.typewriter,
          type: "checkbox"
        }),
        { type: "separator" },
        { label: t("menu.fullScreen"), role: "togglefullscreen" }
      ]
    },
    {
      label: t("menu.window"),
      submenu: [
        { accelerator: "CommandOrControl+Shift+W", click: closeWindow, label: t("menu.closeWindow") },
        { label: t("menu.minimize"), role: "minimize" },
        { label: t("menu.zoom"), role: "zoom" },
        { type: "separator" },
        { label: t("menu.bringAllToFront"), role: "front" }
      ]
    }
  ];
}

function dispatchApplicationMenuCommand(command: ApplicationMenuCommand): void {
  const window = mainWindowProvider();
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
  window.webContents.send(applicationMenuCommandChannel, command);
}

function closeMainWindow(): void {
  const window = mainWindowProvider();
  if (!window || window.isDestroyed()) return;
  window.close();
}

function applyApplicationMenuState(state: ApplicationMenuState): void {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;
  const applicationMenu = menu;

  setEnabled(menuItemIds.closeTab, state.canCloseTab);
  setEnabled(menuItemIds.reopenClosedTab, state.canReopenClosedTab);
  setEnabled(menuItemIds.rightPanel, state.canToggleRightPanel);
  setChecked(menuItemIds.rightPanel, state.isRightPanelOpen);
  setChecked(menuItemIds.sidebar, state.isSidebarOpen);
  setChecked(menuItemIds.split, state.isSplit);
  setChecked(menuItemIds.typewriter, state.isTypewriterMode);

  function setEnabled(id: string, enabled: boolean): void {
    const item = applicationMenu.getMenuItemById(id);
    if (item) item.enabled = enabled;
  }

  function setChecked(id: string, checked: boolean): void {
    const item = applicationMenu.getMenuItemById(id);
    if (item) item.checked = checked;
  }
}
