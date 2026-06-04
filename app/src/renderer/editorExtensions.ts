import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState, type Extension, type StateEffect } from "@codemirror/state";
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
  onOpenWikiLinkRef: RefObject<((target: string, heading?: string) => void) | undefined>,
  t: Translator
) {
  return EditorView.decorations.of((view) => buildLivePreviewDecorations(view, (link) => {
    if (link.type === "markdown" && link.href) {
      onOpenLinkRef.current?.(link.href);
      return;
    }

    if (link.type === "wiki" && link.target) {
      onOpenWikiLinkRef.current?.(link.target, link.heading ?? undefined);
    }
  }, t));
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
const autocompleteCompartment = new Compartment();
const contentAttributesCompartment = new Compartment();
const editorThemeCompartment = new Compartment();
const eventHandlersCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const livePreviewCompartment = new Compartment();
const typewriterCompartment = new Compartment();

interface EditorExtensionConfig {
  allFilePaths: string[];
  frontmatterCandidates: Record<string, string[]>;
  onChangeRef: RefObject<(c: string) => void>;
  onContextMenu: (event: MouseEvent, view: EditorView) => boolean;
  onOpenLinkRef: RefObject<((href: string) => void) | undefined>;
  onOpenWikiLinkRef: RefObject<((target: string, heading?: string) => void) | undefined>;
  onSelectionChange: (state: EditorState) => void;
  settings: EditorSettings;
  sourceMode: boolean;
  t: Translator;
  typewriterMode: boolean;
  userDefinedFields: UserDefinedField[];
}

interface WikiCompletionCandidate {
  apply: string;
  label: string;
  normalizedTerms: string[];
  searchTerms: string[];
}

const maxWikiCompletionOptions = 80;

function normalizeCompletionText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja");
}

function pathWithoutMarkdownExtension(filePath: string): string {
  return filePath.replace(/\.md$/i, "");
}

function basenameWithoutMarkdownExtension(filePath: string): string {
  return filePath.split("/").at(-1)?.replace(/\.md$/i, "") ?? "";
}

function matchRank(candidate: WikiCompletionCandidate, query: string): number | null {
  if (query === "") return 1;

  const normalizedQuery = normalizeCompletionText(query);
  const terms = candidate.normalizedTerms;

  if (terms.some((term) => term === normalizedQuery)) return 0;
  if (terms.some((term) => term.startsWith(normalizedQuery))) return 1;
  if (terms.some((term) => term.includes(normalizedQuery))) return 2;

  return null;
}

function buildWikiCompletionCandidates(allFilePaths: string[], aliasCandidates: string[]): WikiCompletionCandidate[] {
  const basenameMap = new Map<string, string[]>();

  for (const filePath of allFilePaths) {
    const basename = basenameWithoutMarkdownExtension(filePath);

    if (!basename) continue;

    if (!basenameMap.has(basename)) basenameMap.set(basename, []);

    basenameMap.get(basename)!.push(filePath);
  }

  const candidates: WikiCompletionCandidate[] = [];

  for (const [basename, paths] of basenameMap) {
    if (paths.length === 1) {
      const pathLabel = pathWithoutMarkdownExtension(paths[0]);
      candidates.push({
        apply: `${basename}]]`,
        label: basename,
        normalizedTerms: [basename, pathLabel].map(normalizeCompletionText),
        searchTerms: [basename, pathLabel]
      });
    } else {
      for (const filePath of paths) {
        const label = pathWithoutMarkdownExtension(filePath);
        candidates.push({
          apply: `${label}]]`,
          label,
          normalizedTerms: [basename, label].map(normalizeCompletionText),
          searchTerms: [basename, label]
        });
      }
    }
  }

  for (const alias of aliasCandidates) {
    const trimmed = alias.trim();
    if (!trimmed) continue;
    candidates.push({
      apply: `${trimmed}]]`,
      label: trimmed,
      normalizedTerms: [trimmed].map(normalizeCompletionText),
      searchTerms: [trimmed]
    });
  }

  return candidates;
}

export function buildWikiLinkCompletionSource(
  allFilePaths: string[],
  frontmatterCandidates: Record<string, string[]> = {}
) {
  const candidates = buildWikiCompletionCandidates(allFilePaths, frontmatterCandidates.aliases ?? []);

  return (context: CompletionContext): CompletionResult | null => {
    const before = context.matchBefore(/\[\[([^\]\n]*)$/);

    if (!before || (!context.explicit && before.text === "[[")) return null;

    const query = before.text.slice(2);
    const ranked: Array<WikiCompletionCandidate & { rank: number }> = [];

    for (const candidate of candidates) {
      const rank = matchRank(candidate, query);
      if (rank !== null) ranked.push({ ...candidate, rank });
    }

    ranked.sort((a, b) => (
      a.rank - b.rank ||
      a.label.localeCompare(b.label, "ja", { numeric: true, sensitivity: "base" })
    ));

    return {
      filter: false,
      from: before.from + 2,
      options: ranked.slice(0, maxWikiCompletionOptions).map(({ apply, label }) => ({ apply, label }))
    };
  };
}

function buildEditorThemeExtension(settings: EditorSettings): Extension {
  return EditorView.theme({
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
  });
}

function buildContentAttributesExtension(settings: EditorSettings): Extension {
  return EditorView.contentAttributes.of({ spellcheck: settings.spellCheck ? "true" : "false" });
}

function buildLineNumbersExtension(settings: EditorSettings): Extension {
  return settings.showLineNumbers ? lineNumbers() : [];
}

function buildTypewriterExtension(typewriterMode: boolean): Extension {
  return typewriterMode ? typewriterExtension : [];
}

function buildAutocompleteExtension(
  allFilePaths: string[],
  frontmatterCandidates: Record<string, string[]>
): Extension {
  return autocompletion({ override: [buildWikiLinkCompletionSource(allFilePaths, frontmatterCandidates)] });
}

function buildEventHandlersExtension(config: EditorExtensionConfig): Extension {
  return [
    EditorView.domEventHandlers({
      keydown: (event, view) => {
        if (
          composingViews.has(view) ||
          view.compositionStarted ||
          event.isComposing ||
          event.keyCode === 229 ||
          !isListInputEvent(event, view)
        ) {
          return false;
        }
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
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) config.onChangeRef.current!(update.state.doc.toString());
      if (update.selectionSet || update.docChanged) config.onSelectionChange(update.state);
    })
  ];
}

function buildLivePreviewExtensions(config: EditorExtensionConfig): Extension {
  return config.sourceMode ? [] : [
    createFrontmatterPropertiesField(
      config.userDefinedFields,
      config.frontmatterCandidates,
      config.t,
      config.settings.frontmatterDateFormat
    ),
    diagramEditRangeField,
    createLivePreviewTableField(config.t),
    createLivePreviewCodeBlockField(config.t),
    createLivePreviewPlugin(config.onOpenLinkRef, config.onOpenWikiLinkRef, config.t)
  ];
}

export function buildEditorReconfigureEffects(config: EditorExtensionConfig): StateEffect<unknown>[] {
  return [
    autocompleteCompartment.reconfigure(buildAutocompleteExtension(config.allFilePaths, config.frontmatterCandidates)),
    contentAttributesCompartment.reconfigure(buildContentAttributesExtension(config.settings)),
    editorThemeCompartment.reconfigure(buildEditorThemeExtension(config.settings)),
    eventHandlersCompartment.reconfigure(buildEventHandlersExtension(config)),
    lineNumbersCompartment.reconfigure(buildLineNumbersExtension(config.settings)),
    livePreviewCompartment.reconfigure(buildLivePreviewExtensions(config)),
    typewriterCompartment.reconfigure(buildTypewriterExtension(config.typewriterMode))
  ];
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
  const config: EditorExtensionConfig = {
    allFilePaths,
    frontmatterCandidates,
    onChangeRef,
    onContextMenu,
    onOpenLinkRef,
    onOpenWikiLinkRef,
    onSelectionChange,
    settings,
    sourceMode,
    t,
    typewriterMode,
    userDefinedFields
  };

  return [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    editorEditableCompartment.of(EditorView.editable.of(true)),
    markdown({ extensions: GFM }),
    createHeadingFoldingExtension(t),
    EditorView.lineWrapping,
    highlightActiveLine(),
    autocompleteCompartment.of(buildAutocompleteExtension(allFilePaths, frontmatterCandidates)),
    contextSelectionHighlightField,
    frontmatterCollapsedField,
    eventHandlersCompartment.of(buildEventHandlersExtension(config)),
    editorThemeCompartment.of(buildEditorThemeExtension(settings)),
    contentAttributesCompartment.of(buildContentAttributesExtension(settings)),
    lineNumbersCompartment.of(buildLineNumbersExtension(settings)),
    typewriterCompartment.of(buildTypewriterExtension(typewriterMode)),
    livePreviewCompartment.of(buildLivePreviewExtensions(config))
  ];
}
export function destroyEditorView(view: EditorView, container: HTMLElement | null): void {
  view.destroy();
  container?.replaceChildren();
}
