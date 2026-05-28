import { WidgetType } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

import {
  buildDiagramFallback,
  renderDiagramElement,
  type DiagramLanguage,
  type DiagramRenderHandle
} from "./diagramPreview";
import { enterDiagramSourceEdit } from "./editorDiagramEditState";

export class DiagramBlockWidget extends WidgetType {
  readonly className = "cm-live-diagram";

  constructor(
    private readonly source: string,
    private readonly language: DiagramLanguage,
    private readonly blockFrom: number,
    private readonly blockTo: number,
    private readonly editCursor: number
  ) {
    super();
  }

  eq(other: DiagramBlockWidget): boolean {
    return this.source === other.source &&
      this.language === other.language &&
      this.blockFrom === other.blockFrom &&
      this.blockTo === other.blockTo &&
      this.editCursor === other.editCursor;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("div");
    container.className = `preview-diagram preview-diagram--${this.language} cm-live-diagram`;

    let diagramHandle: DiagramRenderHandle | null = null;
    const label = this.language === "d2" ? "D2" : "Mermaid";
    const toolbar = document.createElement("div");
    toolbar.className = "cm-live-diagram-toolbar";
    const fitButton = document.createElement("button");
    fitButton.type = "button";
    fitButton.className = "cm-live-diagram-fit-button";
    fitButton.textContent = "全体表示";
    fitButton.setAttribute("aria-label", `${label}図を全体表示`);
    fitButton.disabled = true;
    fitButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      diagramHandle?.fitToViewport();
    });

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "cm-live-diagram-edit-button";
    editButton.textContent = "ソースを編集";
    editButton.setAttribute("aria-label", `${label}ソースを編集`);
    editButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      enterDiagramSourceEdit(
        view,
        { from: this.blockFrom, to: this.blockTo },
        this.editCursor
      );
    });

    toolbar.append(fitButton, editButton);

    const diagram = document.createElement("div");
    diagram.className = "cm-live-diagram-body";
    diagram.append(buildDiagramFallback(this.language, this.source));
    void renderDiagramElement(diagram, this.language, this.source).then((handle) => {
      diagramHandle = handle;
      fitButton.disabled = !handle;
    });
    container.append(toolbar, diagram);
    return container;
  }

  ignoreEvent(event: Event): boolean {
    return [
      "click",
      "dblclick",
      "dragstart",
      "mousedown",
      "pointercancel",
      "pointerdown",
      "pointermove",
      "pointerup",
      "wheel"
    ].includes(event.type);
  }
}
