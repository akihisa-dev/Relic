import { markdown } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { createElement, createRef, type ComponentProps } from "react";
import { expect, vi } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { buildLivePreviewDecorations } from "../editorLivePreview";
import { buildTableDecorations } from "../editorTables";
import { createTranslator } from "../i18nModel";
import { Editor } from "./Editor";

export const settings = { ...defaultEditorSettings, language: "ja" as const };

type EditorProps = ComponentProps<typeof Editor>;

export function renderEditor(props: Partial<EditorProps> = {}) {
  return render(createElement(Editor, {
    content: props.content ?? "",
    onChange: props.onChange ?? vi.fn(),
    settings: props.settings ?? settings,
    ...props
  }));
}

export async function renderEditorWithView(props: Partial<EditorProps> = {}) {
  const viewRef = createRef<EditorView | null>();
  const renderResult = renderEditor({ ...props, viewRef });

  await waitFor(() => expect(viewRef.current).not.toBeNull());

  return {
    ...renderResult,
    view: viewRef.current!,
    viewRef
  };
}

export async function collectLivePreviewClasses(content: string, cursor: number, hasFocus = true): Promise<Set<string>> {
  const state = EditorState.create({
    doc: content,
    extensions: [markdown({ extensions: GFM })],
    selection: { anchor: cursor }
  });
  await ensureSyntaxTree(state, state.doc.length, 100);

  const classes = new Set<string>();
  buildLivePreviewDecorations({
    hasFocus,
    state,
    visibleRanges: [{ from: 0, to: state.doc.length }]
  } as unknown as EditorView).between(0, state.doc.length, (_from, _to, value) => {
    const cls = (value as unknown as { spec?: { class?: string } }).spec?.class;
    if (cls) classes.add(cls);
  });

  return classes;
}

export async function collectLivePreviewWidgets(content: string, cursor: number, hasFocus = true): Promise<string[]> {
  const state = EditorState.create({
    doc: content,
    extensions: [markdown({ extensions: GFM })],
    selection: { anchor: cursor }
  });
  await ensureSyntaxTree(state, state.doc.length, 100);

  const widgets: string[] = [];
  void hasFocus;
  buildTableDecorations(state, createTranslator("ja")).between(0, state.doc.length, (_from, _to, value) => {
    const widget = (value as unknown as { spec?: { widget?: { constructor?: { name?: string } } } }).spec?.widget;
    if (widget?.constructor?.name) widgets.push(widget.constructor.name);
  });

  return widgets;
}

export async function collectInlineLivePreviewWidgets(content: string, cursor: number, hasFocus = true): Promise<string[]> {
  const state = EditorState.create({
    doc: content,
    extensions: [markdown({ extensions: GFM })],
    selection: { anchor: cursor }
  });
  await ensureSyntaxTree(state, state.doc.length, 100);

  const widgets: string[] = [];
  buildLivePreviewDecorations({
    hasFocus,
    state,
    visibleRanges: [{ from: 0, to: state.doc.length }]
  } as unknown as EditorView).between(0, state.doc.length, (_from, _to, value) => {
    const widget = (value as unknown as { spec?: { widget?: { constructor?: { name?: string } } } }).spec?.widget;
    if (widget?.constructor?.name) widgets.push(widget.constructor.name);
  });

  return widgets;
}

export async function collectInlineLivePreviewWidgetClasses(content: string, cursor: number, hasFocus = true): Promise<string[]> {
  const state = EditorState.create({
    doc: content,
    extensions: [markdown({ extensions: GFM })],
    selection: { anchor: cursor }
  });
  await ensureSyntaxTree(state, state.doc.length, 100);

  const classes: string[] = [];
  buildLivePreviewDecorations({
    hasFocus,
    state,
    visibleRanges: [{ from: 0, to: state.doc.length }]
  } as unknown as EditorView).between(0, state.doc.length, (_from, _to, value) => {
    const widget = (value as unknown as { spec?: { widget?: { className?: string } } }).spec?.widget;
    if (widget?.className) classes.push(widget.className);
  });

  return classes;
}

export async function expandFrontmatter(container: HTMLElement): Promise<void> {
  await waitFor(() => expect(container.querySelector(".cm-frontmatter-header")).not.toBeNull());
  const properties = container.querySelector(".cm-frontmatter-properties");

  if (properties?.getAttribute("data-collapsed") === "true") {
    fireEvent.click(container.querySelector(".cm-frontmatter-header") as HTMLButtonElement);
  }

  await waitFor(() => {
    expect(container.querySelector(".cm-frontmatter-properties")?.getAttribute("data-collapsed")).toBe("false");
  });
}
