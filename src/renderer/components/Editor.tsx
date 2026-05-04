import { defaultKeymap, historyKeymap, history } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

import type { EditorSettings } from "../../shared/ipc";

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  settings: EditorSettings;
  viewRef?: React.MutableRefObject<EditorView | null>;
}

const fontFamilyMap: Record<EditorSettings["font"], string> = {
  mincho: '"Hiragino Mincho ProN", serif',
  mono: "Menlo, monospace",
  system: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif'
};

export function Editor({ content, onChange, settings, viewRef }: EditorProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const extensions = [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown(),
      updateListener,
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
      ...(settings.showLineNumbers ? [lineNumbers()] : [])
    ];

    const state = EditorState.create({ doc: content, extensions });
    const view = new EditorView({ state, parent: containerRef.current });

    internalViewRef.current = view;

    if (viewRef) {
      viewRef.current = view;
    }

    return () => {
      view.destroy();
      internalViewRef.current = null;

      if (viewRef) {
        viewRef.current = null;
      }
    };
    // content は初期値のみ使用。以降は onChange で管理する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 設定変更時にテーマを再適用（エディタを再生成）
  useEffect(() => {
    const view = internalViewRef.current;

    if (!view) return;

    const currentContent = view.state.doc.toString();

    view.destroy();
    internalViewRef.current = null;

    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const extensions = [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown(),
      updateListener,
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
      ...(settings.showLineNumbers ? [lineNumbers()] : [])
    ];

    const state = EditorState.create({ doc: currentContent, extensions });
    const nextView = new EditorView({ state, parent: containerRef.current });

    internalViewRef.current = nextView;

    if (viewRef) {
      viewRef.current = nextView;
    }
  }, [settings, viewRef]);

  return <div className="cm-editor-container" ref={containerRef} />;
}
