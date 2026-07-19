import type { Extension } from "@codemirror/state";
import { EditorView, lineNumbers, ViewPlugin } from "@codemirror/view";
import type { ViewUpdate } from "@codemirror/view";

import type { EditorSettings } from "../shared/ipc";
import { appFontFamilyMap } from "./appFont";
import type { Translator } from "./i18nModel";

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

export function buildEditorThemeExtension(settings: EditorSettings): Extension {
  return EditorView.theme({
    "&": {
      fontFamily: appFontFamilyMap[settings.font],
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
      fontFamily: appFontFamilyMap[settings.font],
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

export function buildContentAttributesExtension(settings: EditorSettings, t: Translator): Extension {
  return EditorView.contentAttributes.of({
    "aria-label": t("editor.markdownInput"),
    spellcheck: settings.spellCheck ? "true" : "false"
  });
}

export function buildLineNumbersExtension(settings: EditorSettings): Extension {
  return settings.showLineNumbers ? lineNumbers() : [];
}

export function buildTypewriterExtension(typewriterMode: boolean): Extension {
  return typewriterMode ? typewriterExtension : [];
}
