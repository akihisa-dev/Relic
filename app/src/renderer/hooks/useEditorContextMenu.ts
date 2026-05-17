import { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, MutableRefObject } from "react";

import {
  readEditorClipboardForPaste,
  usesElectronNativeEditorMenu,
  writeEditorClipboardText
} from "../editorClipboard";
import {
  editorContextMenuPosition,
  type EditorContextMenuState
} from "../editorContextMenuModel";

interface UseEditorContextMenuInput {
  viewRef: MutableRefObject<EditorView | null>;
}

export function useEditorContextMenu({ viewRef }: UseEditorContextMenuInput) {
  const lastSelectionRef = useRef<{ from: number; text: string; to: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<EditorContextMenuState | null>(null);

  const closeContextMenu = useCallback((): void => setContextMenu(null), []);

  const openContextMenu = useCallback((event: MouseEvent, view: EditorView): boolean => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest(".cm-live-table")) return false;
    if (usesElectronNativeEditorMenu()) return false;

    event.preventDefault();
    const position = editorContextMenuPosition(event.clientX, event.clientY);
    const selection = view.state.selection.main;
    let clickedPosition: number | null = null;
    try {
      clickedPosition = view.posAtCoords({ x: event.clientX, y: event.clientY });
    } catch {
      clickedPosition = null;
    }
    let selectionFrom = selection.empty ? clickedPosition ?? selection.from : selection.from;
    let selectionTo = selection.empty ? selectionFrom : selection.to;
    let selectionText = "";

    if (selection.empty) {
      const lastSelection = lastSelectionRef.current;
      if (
        lastSelection &&
        clickedPosition !== null &&
        clickedPosition >= lastSelection.from &&
        clickedPosition <= lastSelection.to
      ) {
        selectionFrom = lastSelection.from;
        selectionTo = lastSelection.to;
        selectionText = lastSelection.text;
      }
    } else {
      selectionText = view.state.sliceDoc(selection.from, selection.to);
      lastSelectionRef.current = {
        from: selection.from,
        text: selectionText,
        to: selection.to
      };
    }

    setContextMenu({
      selectionFrom,
      selectionText,
      selectionTo,
      ...position
    });
    return true;
  }, []);

  const openReactContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>): void => {
    const view = viewRef.current;
    if (!view) return;
    if (openContextMenu(event.nativeEvent, view)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, [openContextMenu, viewRef]);

  const copySelection = useCallback((): void => {
    const view = viewRef.current;
    const selection = view?.state.selection.main;
    const selectionText = view && selection && !selection.empty
      ? view.state.sliceDoc(selection.from, selection.to)
      : contextMenu?.selectionText ?? "";
    if (!selectionText) return;
    void writeEditorClipboardText(selectionText);
  }, [contextMenu?.selectionText, viewRef]);

  const cutSelection = useCallback((): void => {
    const view = viewRef.current;
    if (!view) return;
    const selection = view.state.selection.main;
    const selectionText = !selection.empty
      ? view.state.sliceDoc(selection.from, selection.to)
      : contextMenu?.selectionText ?? "";
    if (!selectionText) return;
    const from = !selection.empty ? selection.from : contextMenu?.selectionFrom ?? selection.from;
    const to = !selection.empty ? selection.to : contextMenu?.selectionTo ?? selection.to;

    void writeEditorClipboardText(selectionText);
    view.dispatch({
      changes: { from, insert: "", to },
      selection: { anchor: from }
    });
    view.focus();
  }, [contextMenu, viewRef]);

  const pasteClipboard = useCallback(async (): Promise<void> => {
    const view = viewRef.current;
    if (!view) return;
    const from = contextMenu?.selectionFrom ?? view.state.selection.main.from;
    const to = contextMenu?.selectionTo ?? view.state.selection.main.to;
    const text = await readEditorClipboardForPaste();

    if (text === "") {
      view.dispatch({ selection: { anchor: from, head: to } });
      view.focus();
      document.execCommand("paste");
      return;
    }

    view.dispatch({
      changes: { from, insert: text, to },
      selection: { anchor: from + text.length }
    });
    view.focus();
  }, [contextMenu, viewRef]);

  const selectAll = useCallback((): void => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    view.focus();
  }, [viewRef]);

  useEffect(() => {
    if (!contextMenu) return;
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest(".editor-context-menu")) return;
      closeContextMenu();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeContextMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeContextMenu, contextMenu]);

  return {
    closeContextMenu,
    contextMenu,
    copySelection,
    cutSelection,
    openContextMenu,
    openReactContextMenu,
    pasteClipboard,
    selectAll
  };
}
