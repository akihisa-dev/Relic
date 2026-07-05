import type { EditorView } from "@codemirror/view";

export interface EditorScrollAnchor {
  offset: number;
  pos: number;
}

export function captureEditorScrollAnchor(view: EditorView): EditorScrollAnchor {
  const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop);

  return {
    offset: view.scrollDOM.scrollTop - block.top,
    pos: Math.min(block.from, view.state.doc.length)
  };
}

export function restoreEditorScrollAnchor(view: EditorView, anchor: EditorScrollAnchor, scrollLeft: number): void {
  const pos = Math.min(anchor.pos, view.state.doc.length);

  view.requestMeasure({
    read: (measuredView) => measuredView.lineBlockAt(pos).top,
    write: (top, measuredView) => {
      measuredView.scrollDOM.scrollLeft = scrollLeft;
      measuredView.scrollDOM.scrollTop = Math.max(0, top + anchor.offset);
    }
  });
}
