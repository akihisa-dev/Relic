import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, ViewPlugin, keymap, lineNumbers } from "@codemirror/view";
import type { ViewUpdate } from "@codemirror/view";
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

import type { EditorSettings } from "../../shared/ipc";

interface EditorProps {
  allFilePaths?: string[];
  content: string;
  onChange: (content: string) => void;
  settings: EditorSettings;
  typewriterMode?: boolean;
  viewRef?: React.MutableRefObject<EditorView | null>;
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
  mincho: '"Hiragino Mincho ProN", serif',
  mono: "Menlo, monospace",
  system: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif'
};

function buildWikiLinkCompletionSource(allFilePaths: string[]) {
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

function buildExtensions(
  settings: EditorSettings,
  typewriterMode: boolean,
  onChangeRef: React.RefObject<(c: string) => void>,
  allFilePaths: string[]
) {
  return [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    markdown(),
    autocompletion({ override: [buildWikiLinkCompletionSource(allFilePaths)] }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChangeRef.current!(update.state.doc.toString());
    }),
    EditorView.theme({
      "&": {
        fontFamily: fontFamilyMap[settings.font],
        fontSize: `${settings.fontSize}px`,
        lineHeight: String(settings.lineHeight),
        height: "100%"
      },
      ".cm-scroller": { overflow: "auto" },
      ".cm-content": {
        maxWidth: settings.maxWidth === "none" ? "none" : settings.maxWidth,
        margin: "0 auto",
        padding: "24px 32px"
      },
      ".cm-focused": { outline: "none" }
    }),
    EditorView.contentAttributes.of({ spellcheck: settings.spellCheck ? "true" : "false" }),
    ...(settings.showLineNumbers ? [lineNumbers()] : []),
    ...(typewriterMode ? [typewriterExtension] : [])
  ];
}

export function Editor({
  allFilePaths = [],
  content,
  onChange,
  settings,
  typewriterMode = false,
  viewRef
}: EditorProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const allFilePathsRef = useRef(allFilePaths);

  onChangeRef.current = onChange;
  allFilePathsRef.current = allFilePaths;

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = buildExtensions(settings, typewriterMode, onChangeRef, allFilePathsRef.current);
    const state = EditorState.create({ doc: content, extensions });
    const view = new EditorView({ state, parent: containerRef.current });

    internalViewRef.current = view;

    if (viewRef) viewRef.current = view;

    return () => {
      view.destroy();
      internalViewRef.current = null;
      if (viewRef) viewRef.current = null;
    };
    // content は初期値のみ使用。以降は onChange で管理する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 設定・タイプライターモード変更時にエディタを再生成
  useEffect(() => {
    const view = internalViewRef.current;

    if (!view) return;

    const currentContent = view.state.doc.toString();

    view.destroy();
    internalViewRef.current = null;

    if (!containerRef.current) return;

    const extensions = buildExtensions(settings, typewriterMode, onChangeRef, allFilePathsRef.current);
    const state = EditorState.create({ doc: currentContent, extensions });
    const nextView = new EditorView({ state, parent: containerRef.current });

    internalViewRef.current = nextView;

    if (viewRef) viewRef.current = nextView;
  }, [settings, typewriterMode, viewRef]);

  return <div className="cm-editor-container" ref={containerRef} />;
}
