import { EditorView } from "@codemirror/view";
import { useEffect } from "react";
import type { MutableRefObject } from "react";

export function usePaneHeadingScroll({
  onScrollTargetHandled,
  scrollTargetHeading,
  viewRef
}: {
  onScrollTargetHandled?: () => void;
  scrollTargetHeading?: string;
  viewRef: MutableRefObject<EditorView | null>;
}): void {
  useEffect(() => {
    if (!scrollTargetHeading || !viewRef.current) return;
    const view = viewRef.current;
    const doc = view.state.doc;
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      if (/^#{1,6} /.test(line.text) && line.text.replace(/^#{1,6} /, "") === scrollTargetHeading) {
        view.dispatch({
          effects: EditorView.scrollIntoView(line.from, { y: "center" }),
          selection: { anchor: line.from }
        });
        break;
      }
    }
    onScrollTargetHandled?.();
  }, [onScrollTargetHandled, scrollTargetHeading, viewRef]);
}
