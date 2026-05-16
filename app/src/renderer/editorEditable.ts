import { Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export const editorEditableCompartment = new Compartment();

export function setEditorEditable(view: EditorView, editable: boolean): void {
  view.dispatch({
    effects: editorEditableCompartment.reconfigure(EditorView.editable.of(editable))
  });
}
