import { EditorView } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, MutableRefObject } from "react";

import { readEditorClipboardTextForPaste, writeEditorClipboardText } from "../editorClipboard";
import { setContextSelectionHighlightEffect } from "../editorContextSelectionHighlight";
import {
  editorContextMenuPosition,
  type EditorContextMenuState
} from "../editorContextMenuModel";

interface UseEditorContextMenuInput {
  viewRef: MutableRefObject<EditorView | null>;
}

interface StoredSelection {
  from: number;
  text: string;
  to: number;
}

function selectionForCurrentDocument(state: EditorState, selection: StoredSelection): StoredSelection | null {
  if (selection.from < 0 || selection.from > selection.to || selection.to > state.doc.length) return null;
  if (state.sliceDoc(selection.from, selection.to) !== selection.text) return null;
  return selection;
}

function contextSelectionForCurrentDocument(
  state: EditorState,
  selection: EditorContextMenuState
): StoredSelection | null {
  return selectionForCurrentDocument(state, {
    from: selection.selectionFrom,
    text: selection.selectionText,
    to: selection.selectionTo
  });
}

export function useEditorContextMenu({ viewRef }: UseEditorContextMenuInput) {
  const openedGestureRef = useRef<{ openedAt: number; x: number; y: number } | null>(null);
  const lastSelectionRef = useRef<StoredSelection | null>(null);
  const [contextMenu, setContextMenu] = useState<EditorContextMenuState | null>(null);

  const closeContextMenu = useCallback((): void => {
    openedGestureRef.current = null;
    viewRef.current?.dispatch({ effects: setContextSelectionHighlightEffect.of(null) });
    setContextMenu(null);
  }, [viewRef]);

  const rememberSelection = useCallback((state: EditorState): void => {
    const selection = state.selection.main;
    if (selection.empty) return;

    lastSelectionRef.current = {
      from: selection.from,
      text: state.sliceDoc(selection.from, selection.to),
      to: selection.to
    };
  }, []);

  const openContextMenu = useCallback((event: MouseEvent, view: EditorView): boolean => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest(".cm-live-table")) return false;

    event.preventDefault();
    const position = editorContextMenuPosition(event.clientX, event.clientY);
    const openedGesture = openedGestureRef.current;
    if (
      openedGesture &&
      Date.now() - openedGesture.openedAt < 500 &&
      Math.abs(openedGesture.x - event.clientX) <= 2 &&
      Math.abs(openedGesture.y - event.clientY) <= 2
    ) {
      return true;
    }
    const selection = view.state.selection.main;
    let clickedPosition: number | null = null;
    try {
      const positionAtClick = view.posAtCoords({ x: event.clientX, y: event.clientY });
      clickedPosition = typeof positionAtClick === "number" && Number.isFinite(positionAtClick)
        ? Math.max(0, Math.min(positionAtClick, view.state.doc.length))
        : null;
    } catch {
      clickedPosition = null;
    }
    let selectionFrom = selection.from;
    let selectionTo = selection.empty ? selectionFrom : selection.to;
    let selectionText = "";

    const clickedInsideCurrentSelection = clickedPosition !== null
      && !selection.empty
      && clickedPosition >= selection.from
      && clickedPosition < selection.to;

    if (!selection.empty && clickedInsideCurrentSelection) {
      selectionText = view.state.sliceDoc(selection.from, selection.to);
      lastSelectionRef.current = {
        from: selection.from,
        text: selectionText,
        to: selection.to
      };
    } else if (selection.empty) {
      const lastSelection = lastSelectionRef.current
        ? selectionForCurrentDocument(view.state, lastSelectionRef.current)
        : null;
      if (!lastSelection) lastSelectionRef.current = null;
      if (
        lastSelection &&
        clickedPosition !== null &&
        clickedPosition >= lastSelection.from &&
        clickedPosition < lastSelection.to
      ) {
        selectionFrom = lastSelection.from;
        selectionTo = lastSelection.to;
        selectionText = lastSelection.text;
      } else if (clickedPosition !== null) {
        selectionFrom = clickedPosition;
        selectionTo = clickedPosition;
      }
    } else if (clickedPosition !== null) {
      selectionFrom = clickedPosition;
      selectionTo = clickedPosition;
    }

    if (selectionFrom !== selectionTo) {
      view.dispatch({
        effects: setContextSelectionHighlightEffect.of({ from: selectionFrom, to: selectionTo }),
        selection: {
          anchor: selectionFrom,
          head: selectionTo
        }
      });
      view.focus();
    } else {
      view.dispatch({
        effects: setContextSelectionHighlightEffect.of(null),
        selection: { anchor: selectionFrom }
      });
      view.focus();
    }

    setContextMenu({
      selectionFrom,
      selectionText,
      selectionTo,
      ...position
    });
    openedGestureRef.current = {
      openedAt: Date.now(),
      x: event.clientX,
      y: event.clientY
    };
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

  const copySelection = useCallback(async (): Promise<void> => {
    const view = viewRef.current;
    const selection = view?.state.selection.main;
    const contextSelection = view && contextMenu
      ? contextSelectionForCurrentDocument(view.state, contextMenu)
      : null;
    const selectionText = view && selection && !selection.empty
      ? view.state.sliceDoc(selection.from, selection.to)
      : contextSelection?.text ?? "";
    if (!selectionText) return;
    await writeEditorClipboardText(selectionText);
  }, [contextMenu, viewRef]);

  const cutSelection = useCallback(async (): Promise<void> => {
    const view = viewRef.current;
    if (!view) return;
    const selection = view.state.selection.main;
    const contextSelection = contextMenu
      ? contextSelectionForCurrentDocument(view.state, contextMenu)
      : null;
    const selectionText = !selection.empty
      ? view.state.sliceDoc(selection.from, selection.to)
      : contextSelection?.text ?? "";
    if (!selectionText) return;
    const from = !selection.empty ? selection.from : contextSelection?.from ?? selection.from;
    const to = !selection.empty ? selection.to : contextSelection?.to ?? selection.to;

    await writeEditorClipboardText(selectionText);
    if (view.state.sliceDoc(from, to) !== selectionText) return;

    view.dispatch({
      changes: { from, insert: "", to },
      selection: { anchor: from }
    });
    view.focus();
  }, [contextMenu, viewRef]);

  const pasteClipboard = useCallback(async (): Promise<void> => {
    const view = viewRef.current;
    if (!view) return;
    const contextSelection = contextMenu
      ? contextSelectionForCurrentDocument(view.state, contextMenu)
      : null;
    const from = contextSelection?.from ?? view.state.selection.main.from;
    const to = contextSelection?.to ?? view.state.selection.main.to;

    try {
      const text = await readEditorClipboardTextForPaste();
      view.dispatch({
        changes: { from, insert: text, to },
        selection: { anchor: from + text.length }
      });
      view.focus();
      return;
    } catch {
      // Fall through to the browser paste command for environments that deny Clipboard API reads.
    }

    view.dispatch({ selection: { anchor: from, head: to } });
    view.focus();
    document.execCommand("paste");
  }, [contextMenu, viewRef]);

  const selectAll = useCallback((): void => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    view.focus();
  }, [viewRef]);

  const prepareContextSelection = useCallback((): EditorView | null => {
    const view = viewRef.current;
    if (!view || !contextMenu) return null;

    const contextSelection = contextSelectionForCurrentDocument(view.state, contextMenu);
    if (!contextSelection) {
      closeContextMenu();
      return null;
    }

    view.dispatch({
      selection: {
        anchor: contextSelection.from,
        head: contextSelection.to
      }
    });
    view.focus();
    return view;
  }, [contextMenu, viewRef]);

  useEffect(() => {
    if (!contextMenu) return;
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Element && target.closest(".editor-context-menu")) return;
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
    rememberSelection,
    openContextMenu,
    openReactContextMenu,
    pasteClipboard,
    prepareContextSelection,
    selectAll
  };
}
