import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, ViewPlugin, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import type { ViewUpdate } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import type { RefObject } from "react";

import type { EditorSettings, UserDefinedField } from "../shared/ipc";
import { contextSelectionHighlightField } from "./editorContextSelectionHighlight";
import { editorEditableCompartment } from "./editorEditable";
import { createFrontmatterPropertiesField, frontmatterCollapsedField } from "./editorFrontmatter";
import { createHeadingFoldingExtension } from "./editorHeadingFolding";
import { handleMarkdownListEnter, indentMarkdownListSelection, isListInputEvent, moveSelectedLines } from "./editorListInput";
import { buildLivePreviewDecorations, createLivePreviewCodeBlockField, findClickableLinkAtPosition } from "./editorLivePreview";
import { diagramEditRangeField } from "./editorDiagramEditState";
import { createLivePreviewTableField } from "./editorTables";
import type { Translator } from "./i18nModel";

function createLivePreviewPlugin(
  onOpenLinkRef: RefObject<((href: string) => void) | undefined>,
  onOpenWikiLinkRef: RefObject<((target: string, heading?: string) => void) | undefined>
) {
  return EditorView.decorations.of((view) => buildLivePreviewDecorations(view, (link) => {
    if (link.type === "markdown" && link.href) {
      onOpenLinkRef.current?.(link.href);
      return;
    }

    if (link.type === "wiki" && link.target) {
      onOpenWikiLinkRef.current?.(link.target, link.heading ?? undefined);
    }
  }));
}
const typewriterExtension = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate): void {
      if (!update.selectionSet && !update.docChanged) return;

      const { view } = update;
      const cursor = view.state.selection.main.head;
      const line = view.lineBlockAt(cursor);
      const scroller = view.scrollDOM;
      const target = line.top - scroller.clientHeight / 2 + line.height / 2;

      scroller.scrollTop = Math.max(0, target);
    }
  }
);

const fontFamilyMap: Record<EditorSettings["font"], string> = {
  gothic: '"Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", "MS Mincho", serif',
  mono: 'Menlo, Consolas, "Courier New", monospace',
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
};
const composingViews = new WeakSet<EditorView>();

export function buildWikiLinkCompletionSource(allFilePaths: string[]) {
  const basenameMap = new Map<string, string[]>();

  for (const filePath of allFilePaths) {
    const basename = filePath.split("/").at(-1)?.replace(/\.md$/, "") ?? "";

    if (!basename) continue;

    if (!basenameMap.has(basename)) basenameMap.set(basename, []);

    basenameMap.get(basename)!.push(filePath);
  }

  return (context: CompletionContext): CompletionResult | null => {
    const before = context.matchBefore(/\[\[([^\]\n]*)$/);

    if (!before || (!context.explicit && before.text === "[[")) return null;

    const options: { apply: string; label: string }[] = [];

    for (const [basename, paths] of basenameMap) {
      if (paths.length === 1) {
        options.push({ apply: `${basename}]]`, label: basename });
      } else {
        for (const filePath of paths) {
          const label = filePath.replace(/\.md$/, "");
          options.push({ apply: `${label}]]`, label });
        }
      }
    }

    return {
      filter: true,
      from: before.from + 2,
      options
    };
  };
}
export function buildExtensions(
  settings: EditorSettings,
  typewriterMode: boolean,
  sourceMode: boolean,
  onChangeRef: RefObject<(c: string) => void>,
  allFilePaths: string[],
  userDefinedFields: UserDefinedField[],
  frontmatterCandidates: Record<string, string[]>,
  t: Translator,
  onContextMenu: (event: MouseEvent, view: EditorView) => boolean,
  onSelectionChange: (state: EditorState) => void,
  onOpenLinkRef: RefObject<((href: string) => void) | undefined>,
  onOpenWikiLinkRef: RefObject<((target: string, heading?: string) => void) | undefined>
) {
  const constrainedContentWidth = settings.maxWidth === "none" ? null : settings.maxWidth;

  return [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    editorEditableCompartment.of(EditorView.editable.of(true)),
    markdown({ extensions: GFM }),
    createHeadingFoldingExtension(t),
    EditorView.lineWrapping,
    highlightActiveLine(),
    autocompletion({ override: [buildWikiLinkCompletionSource(allFilePaths)] }),
    contextSelectionHighlightField,
    frontmatterCollapsedField,
    EditorView.domEventHandlers({
      keydown: (event, view) => {
        if (composingViews.has(view) || !isListInputEvent(event, view)) return false;
        if (event.key === "Enter" && handleMarkdownListEnter(view)) {
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
      compositionstart: (_event, view) => {
        composingViews.add(view);
        return false;
      },
      compositionend: (_event, view) => {
        composingViews.delete(view);
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
          onOpenLinkRef.current?.(link.href);
          return true;
        }

        if (link.type === "wiki" && link.target) {
          onOpenWikiLinkRef.current?.(link.target, link.heading ?? undefined);
          return true;
        }

        return false;
      },
      contextmenu: onContextMenu
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChangeRef.current!(update.state.doc.toString());
      if (update.selectionSet || update.docChanged) onSelectionChange(update.state);
    }),
    EditorView.theme({
      "&": {
        fontFamily: fontFamilyMap[settings.font],
        fontSize: `${settings.fontSize}px`,
        lineHeight: String(settings.lineHeight),
        height: "100%"
      },
      ".cm-scroller": {
        overflow: "auto"
      },
      ".cm-gutters": {
        flexShrink: "0",
        padding: "8px 0 24px"
      },
      ".cm-content": {
        boxSizing: "border-box",
        maxWidth: settings.maxWidth === "none" ? "none" : settings.maxWidth,
        margin: "0 auto",
        padding: "8px 32px 24px"
      },
      ".cm-line": {
        overflowWrap: "anywhere",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      },
      ".cm-activeLine": {
        backgroundColor: "var(--accent-softer)"
      },
      ".cm-focused": { outline: "none" }
    }),
    EditorView.contentAttributes.of({ spellcheck: settings.spellCheck ? "true" : "false" }),
    ...(settings.showLineNumbers ? [lineNumbers()] : []),
    ...(typewriterMode ? [typewriterExtension] : []),
    ...(!sourceMode ? [
      createFrontmatterPropertiesField(userDefinedFields, frontmatterCandidates, t, settings.frontmatterDateFormat),
      diagramEditRangeField,
      createLivePreviewTableField(t),
      createLivePreviewCodeBlockField(),
      createLivePreviewPlugin(onOpenLinkRef, onOpenWikiLinkRef)
    ] : [])
  ];
}
export function destroyEditorView(view: EditorView, container: HTMLElement | null): void {
  view.destroy();
  container?.replaceChildren();
}
