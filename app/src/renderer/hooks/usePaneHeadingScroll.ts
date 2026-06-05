import type { Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect } from "react";
import type { MutableRefObject } from "react";

import type { HeadingScrollTarget } from "../editorDerivedState";

function isLineScrollTarget(target: HeadingScrollTarget): target is Extract<HeadingScrollTarget, { type: "line" }> {
  return typeof target === "object" && "type" in target && target.type === "line";
}

function getHeadingText(lineText: string): string | null {
  if (!/^#{1,6} /.test(lineText)) return null;
  return lineText.replace(/^#{1,6} /, "");
}

function findHeadingLine(doc: Text, target: HeadingScrollTarget): { from: number } | null {
  if (isLineScrollTarget(target)) {
    const lineNumber = Math.max(1, Math.min(target.lineNumber, doc.lines));
    return doc.line(lineNumber);
  }

  if (typeof target !== "string") {
    const position = Math.max(0, Math.min(target.from, doc.length));
    const line = doc.lineAt(position);
    if (getHeadingText(line.text) === target.text) return line;
  }

  const text = typeof target === "string" ? target : target.text;
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (getHeadingText(line.text) === text) return line;
  }

  return null;
}

export function usePaneHeadingScroll({
  onScrollTargetHandled,
  scrollTargetHeading,
  viewRef
}: {
  onScrollTargetHandled?: () => void;
  scrollTargetHeading?: HeadingScrollTarget;
  viewRef: MutableRefObject<EditorView | null>;
}): void {
  useEffect(() => {
    if (!scrollTargetHeading || !viewRef.current) return;
    const view = viewRef.current;
    const line = findHeadingLine(view.state.doc, scrollTargetHeading);
    if (line) {
      view.dispatch({
        effects: EditorView.scrollIntoView(line.from, { y: "center" }),
        selection: { anchor: line.from }
      });
    }
    onScrollTargetHandled?.();
  }, [onScrollTargetHandled, scrollTargetHeading, viewRef]);
}
