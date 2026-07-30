import { Menu, type BrowserWindow } from "electron";

import { getMainTranslator } from "./i18n";

export function configureEditorContextMenu(window: BrowserWindow): void {
  window.webContents.on("context-menu", (event, params) => {
    if (!params.isEditable) return;

    event.preventDefault();
    void getMainTranslator().then((t) => {
      Menu.buildFromTemplate([
        { enabled: params.editFlags.canUndo, label: t("editor.undo"), click: () => window.webContents.undo() },
        { enabled: params.editFlags.canRedo, label: t("editor.redo"), click: () => window.webContents.redo() },
        { type: "separator" },
        { enabled: params.editFlags.canCut, label: t("editor.cut"), click: () => window.webContents.cut() },
        { enabled: params.editFlags.canCopy, label: t("editor.copy"), click: () => window.webContents.copy() },
        { enabled: params.editFlags.canPaste, label: t("editor.paste"), click: () => window.webContents.paste() },
        { type: "separator" },
        { enabled: params.editFlags.canSelectAll, label: t("editor.selectAll"), click: () => window.webContents.selectAll() }
      ]).popup({ window });
    });
  });
}
