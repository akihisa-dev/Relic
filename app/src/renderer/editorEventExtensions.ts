import { completionStatus } from "@codemirror/autocomplete";
import { Prec, Transaction, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

import type { EditorExtensionConfig } from "./editorExtensionTypes";
import {
  handleMarkdownListEnter,
  handleMarkdownListBackspace,
  handleMarkdownListPaste,
  indentMarkdownListSelection,
  isListInputEvent,
  moveSelectedLines
} from "./editorListInput";
import { findClickableLinkAtPosition, livePreviewCompositionEndedEffect } from "./editorLivePreview";
import type { Translator } from "./i18nModel";
import { insertMarkdownLink, wrapSelection } from "./toolbarCommands";

const composingViews = new WeakSet<EditorView>();
const compositionEndedViews = new WeakSet<EditorView>();

function markEditorCompositionStarted(view: EditorView): void {
  composingViews.add(view);
  compositionEndedViews.delete(view);
}

function markEditorCompositionEnded(view: EditorView): void {
  composingViews.delete(view);
  compositionEndedViews.add(view);
}

export function isEditorComposing(view: EditorView): boolean {
  return composingViews.has(view) || (view.compositionStarted && !compositionEndedViews.has(view));
}

function isContinuousTypingTransaction(transaction: Transaction): boolean {
  if (!transaction.docChanged) return true;

  const userEvent = transaction.annotation(Transaction.userEvent);
  return userEvent === "input.type" ||
    userEvent?.startsWith("input.type.") === true ||
    userEvent === "delete.backward" ||
    userEvent === "delete.forward" ||
    userEvent === "delete.selection";
}

/** @internal Test-only hook for IME composition quality gates. */
export const __markEditorCompositionStartedForTests = markEditorCompositionStarted;

/** @internal Test-only hook for IME composition quality gates. */
export const __markEditorCompositionEndedForTests = markEditorCompositionEnded;

export function buildEventHandlersExtension(config: EditorExtensionConfig): Extension {
  return [
    Prec.highest(EditorView.domEventHandlers({
      keydown: (event, view) => {
        if (
          isEditorComposing(view) ||
          event.isComposing ||
          event.keyCode === 229
        ) {
          return true;
        }
        if (!isListInputEvent(event, view)) {
          return false;
        }
        if (event.key === "Tab" && completionStatus(view.state) !== null) {
          return false;
        }
        if (event.key === "Enter" && handleMarkdownListEnter(view)) {
          event.preventDefault();
          return true;
        }
        if (event.key === "Backspace" && handleMarkdownListBackspace(view)) {
          event.preventDefault();
          return true;
        }
        if (event.key === "Tab" && indentMarkdownListSelection(view, event.shiftKey ? -1 : 1)) {
          event.preventDefault();
          return true;
        }
        if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key === "ArrowUp" && moveSelectedLines(view, -1)) {
          event.preventDefault();
          return true;
        }
        if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key === "ArrowDown" && moveSelectedLines(view, 1)) {
          event.preventDefault();
          return true;
        }
        return false;
      },
      paste: (event, view) => {
        if (isEditorComposing(view)) return false;

        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (!handleMarkdownListPaste(view, text)) return false;

        event.preventDefault();
        return true;
      },
      compositionstart: (_event, view) => {
        markEditorCompositionStarted(view);
        return false;
      },
      compositionend: (_event, view) => {
        markEditorCompositionEnded(view);
        queueMicrotask(() => {
          if (view.dom.isConnected) {
            view.dispatch({ effects: livePreviewCompositionEndedEffect.of(null) });
          }
        });
        return false;
      },
      click: (event, view) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.closest(".cm-live-link")) return false;
        if (event.defaultPrevented || event.button !== 0) return false;

        const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (position === null) return false;

        const link = findClickableLinkAtPosition(view.state.doc, position);
        if (!link) return false;

        event.preventDefault();
        event.stopPropagation();

        if (link.type === "markdown" && link.href) {
          config.onOpenLinkRef.current?.(link.href);
          return true;
        }

        if (link.type === "wiki" && link.target) {
          config.onOpenWikiLinkRef.current?.(link.target, link.heading ?? undefined);
          return true;
        }

        return false;
      },
      contextmenu: config.onContextMenu
    })),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        if (update.transactions.every(isContinuousTypingTransaction)) {
          config.onTypingChangeRef.current!(update.state.doc, update.changes);
        } else {
          config.onChangeRef.current!(update.state.doc.toString(), update.changes);
        }
      }
      if (update.selectionSet || update.docChanged) config.onSelectionChange(update.state);
    })
  ];
}

export function buildMarkdownFormattingKeymapExtension(t: Translator): Extension {
  return Prec.highest(keymap.of([
    {
      key: "Mod-b",
      run: (view) => {
        wrapSelection(view, "**", "**", t("toolbar.placeholderText"));
        return true;
      }
    },
    {
      key: "Mod-i",
      run: (view) => {
        wrapSelection(view, "*", "*", t("toolbar.placeholderText"));
        return true;
      }
    },
    {
      key: "Mod-k",
      run: (view) => {
        insertMarkdownLink(view, "URL", t("toolbar.placeholderLinkText"));
        return true;
      }
    }
  ]));
}
