import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState, type Extension, type StateEffect } from "@codemirror/state";
import { EditorView, highlightActiveLine, keymap } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import type { RefObject } from "react";

import type { EditorSettings, UserDefinedField } from "../shared/ipc";
import { buildAutocompleteExtension } from "./editorCompletionExtensions";
import { contextSelectionHighlightField } from "./editorContextSelectionHighlight";
import { diagramEditRangeField } from "./editorDiagramEditState";
import { editorEditableCompartment } from "./editorEditable";
import type { EditorExtensionConfig } from "./editorExtensionTypes";
import {
  buildEventHandlersExtension,
  buildMarkdownFormattingKeymapExtension
} from "./editorEventExtensions";
import { createFrontmatterPropertiesField, frontmatterCollapsedField } from "./editorFrontmatter";
import { createHeadingFoldingExtension } from "./editorHeadingFolding";
import {
  buildLivePreviewDecorations,
  createLivePreviewCodeBlockField
} from "./editorLivePreview";
import { createLivePreviewTableField } from "./editorTables";
import {
  buildContentAttributesExtension,
  buildEditorThemeExtension,
  buildLineNumbersExtension,
  buildTypewriterExtension
} from "./editorThemeExtensions";
import type { Translator } from "./i18nModel";

function createLivePreviewPlugin(
  onOpenLinkRef: RefObject<((href: string) => void) | undefined>,
  onOpenWikiLinkRef: RefObject<((target: string, heading?: string) => void) | undefined>,
  t: Translator,
  workspacePath?: string | null,
  sourcePath?: string
) {
  return EditorView.decorations.of((view) => buildLivePreviewDecorations(view, (link) => {
    if (link.type === "markdown" && link.href) {
      onOpenLinkRef.current?.(link.href);
      return;
    }

    if (link.type === "wiki" && link.target) {
      onOpenWikiLinkRef.current?.(link.target, link.heading ?? undefined);
    }
  }, t, workspacePath, sourcePath));
}

const autocompleteCompartment = new Compartment();
const contentAttributesCompartment = new Compartment();
const editorThemeCompartment = new Compartment();
const eventHandlersCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const livePreviewCompartment = new Compartment();
const markdownFormattingKeymapCompartment = new Compartment();
const typewriterCompartment = new Compartment();

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
    createLivePreviewPlugin(config.onOpenLinkRef, config.onOpenWikiLinkRef, config.t, config.workspacePath, config.sourcePath)
  ];
}

export function buildEditorReconfigureEffects(config: EditorExtensionConfig): StateEffect<unknown>[] {
  return [
    autocompleteCompartment.reconfigure(buildAutocompleteExtension(config.allFilePaths, config.frontmatterCandidates, config.workspacePath)),
    contentAttributesCompartment.reconfigure(buildContentAttributesExtension(config.settings, config.t)),
    editorThemeCompartment.reconfigure(buildEditorThemeExtension(config.settings)),
    eventHandlersCompartment.reconfigure(buildEventHandlersExtension(config)),
    lineNumbersCompartment.reconfigure(buildLineNumbersExtension(config.settings)),
    livePreviewCompartment.reconfigure(buildLivePreviewExtensions(config)),
    markdownFormattingKeymapCompartment.reconfigure(buildMarkdownFormattingKeymapExtension(config.t)),
    typewriterCompartment.reconfigure(buildTypewriterExtension(config.typewriterMode))
  ];
}

export function buildExtensions(
  settings: EditorSettings,
  typewriterMode: boolean,
  sourceMode: boolean,
  onChangeRef: RefObject<(content: string) => void>,
  onTypingChangeRef: RefObject<(content: string) => void>,
  allFilePaths: string[],
  userDefinedFields: UserDefinedField[],
  frontmatterCandidates: Record<string, string[]>,
  t: Translator,
  onContextMenu: (event: MouseEvent, view: EditorView) => boolean,
  onSelectionChange: (state: EditorState) => void,
  onOpenLinkRef: RefObject<((href: string) => void) | undefined>,
  onOpenWikiLinkRef: RefObject<((target: string, heading?: string) => void) | undefined>,
  workspacePath?: string | null,
  sourcePath?: string
) {
  const config: EditorExtensionConfig = {
    allFilePaths,
    frontmatterCandidates,
    onChangeRef,
    onContextMenu,
    onOpenLinkRef,
    onOpenWikiLinkRef,
    onSelectionChange,
    onTypingChangeRef,
    settings,
    sourcePath,
    sourceMode,
    t,
    typewriterMode,
    userDefinedFields,
    workspacePath
  };

  return [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    editorEditableCompartment.of(EditorView.editable.of(true)),
    markdown({ extensions: GFM }),
    createHeadingFoldingExtension(t),
    EditorView.lineWrapping,
    highlightActiveLine(),
    autocompleteCompartment.of(buildAutocompleteExtension(allFilePaths, frontmatterCandidates, workspacePath)),
    markdownFormattingKeymapCompartment.of(buildMarkdownFormattingKeymapExtension(t)),
    contextSelectionHighlightField,
    frontmatterCollapsedField,
    eventHandlersCompartment.of(buildEventHandlersExtension(config)),
    editorThemeCompartment.of(buildEditorThemeExtension(settings)),
    contentAttributesCompartment.of(buildContentAttributesExtension(settings, t)),
    lineNumbersCompartment.of(buildLineNumbersExtension(settings)),
    typewriterCompartment.of(buildTypewriterExtension(typewriterMode)),
    livePreviewCompartment.of(buildLivePreviewExtensions(config))
  ];
}

export function destroyEditorView(view: EditorView, container: HTMLElement | null): void {
  view.destroy();
  container?.replaceChildren();
}
