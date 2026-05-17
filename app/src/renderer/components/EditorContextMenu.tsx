import type { ReactElement } from "react";
import { createPortal } from "react-dom";

import type { EditorContextMenuState } from "../editorContextMenuModel";
import { useT } from "../i18n";

interface EditorContextMenuProps {
  contextMenu: EditorContextMenuState | null;
  onClose: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => Promise<void> | void;
  onSelectAll: () => void;
}

export function EditorContextMenu({
  contextMenu,
  onClose,
  onCopy,
  onCut,
  onPaste,
  onSelectAll
}: EditorContextMenuProps): ReactElement | null {
  const t = useT();

  if (!contextMenu) return null;

  return createPortal(
    <div
      className="tab-context-menu editor-context-menu"
      role="menu"
      style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 1000 }}
    >
      <button
        className="tab-context-menu-item"
        onClick={() => {
          onCopy();
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        {t("editor.copy")}
      </button>
      <button
        className="tab-context-menu-item"
        onClick={() => {
          onCut();
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        {t("editor.cut")}
      </button>
      <button
        className="tab-context-menu-item"
        onClick={async () => {
          await onPaste();
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        {t("editor.paste")}
      </button>
      <div className="tab-context-menu-separator" />
      <button
        className="tab-context-menu-item"
        onClick={() => {
          onSelectAll();
          onClose();
        }}
        role="menuitem"
        type="button"
      >
        {t("editor.selectAll")}
      </button>
    </div>,
    document.body
  );
}
