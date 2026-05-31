import { WidgetType } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

import {
  buildDiagramFallback,
  renderDiagramElement,
  type DiagramLanguage,
  type DiagramRenderHandle
} from "./diagramPreview";
import { getRenderedDiagramSvgText } from "./diagramSvg";
import { enterDiagramSourceEdit } from "./editorDiagramEditState";
import { buildDiagramDefaultFileName } from "./outputHtml";

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

  override eq(other: DiagramBlockWidget): boolean {
    return this.source === other.source &&
      this.language === other.language &&
      this.blockFrom === other.blockFrom &&
      this.blockTo === other.blockTo &&
      this.editCursor === other.editCursor;
  }

  override toDOM(view: EditorView): HTMLElement {
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
      if (handle) {
        toolbar.append(
          createDiagramSvgSaveButton(view, diagram, this.language, this.blockFrom),
          createDiagramSvgCopyButton(diagram, this.language)
        );
      }
    });
    container.append(toolbar, diagram);
    return container;
  }

  override ignoreEvent(event: Event): boolean {
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

function createDiagramSvgSaveButton(
  view: EditorView,
  diagram: HTMLElement,
  language: DiagramLanguage,
  blockFrom: number
): HTMLButtonElement {
  const label = "SVGとして保存";
  const button = createDiagramOutputButton(label);
  button.setAttribute("aria-label", `${language === "d2" ? "D2" : "Mermaid"}図をSVGとして保存`);

  button.addEventListener("click", (event) => {
    stopDiagramOutputEvent(event);
    const svg = getRenderedDiagramSvgText(diagram);
    if (!svg || !window.relic) {
      setTemporaryButtonText(button, "保存できませんでした", label);
      return;
    }

    const fileName = view.dom
      .closest<HTMLElement>(".cm-editor-shell")
      ?.dataset.outputFileName;
    const diagramIndex = diagramIndexForBlock(view.state.doc.toString(), blockFrom);
    const defaultFileName = buildDiagramDefaultFileName(fileName, diagramIndex, language);

    void window.relic.saveDiagramSvg({ defaultFileName, language, svg }).then((result) => {
      if (result.ok && result.value.status === "saved") {
        setTemporaryButtonText(button, "保存しました", label);
        return;
      }

      if (result.ok && result.value.status === "canceled") return;

      setTemporaryButtonText(button, result.ok ? "保存できませんでした" : result.error.message, label);
    }).catch((error) => {
      setTemporaryButtonText(button, error instanceof Error ? error.message : "保存できませんでした", label);
    });
  });

  return button;
}

function createDiagramSvgCopyButton(diagram: HTMLElement, language: DiagramLanguage): HTMLButtonElement {
  const label = "SVGをコピー";
  const button = createDiagramOutputButton(label);
  button.setAttribute("aria-label", `${language === "d2" ? "D2" : "Mermaid"}図のSVGをコピー`);

  button.addEventListener("click", (event) => {
    stopDiagramOutputEvent(event);
    const svg = getRenderedDiagramSvgText(diagram);
    if (!svg || !window.relic) {
      setTemporaryButtonText(button, "コピーできませんでした", label);
      return;
    }

    void window.relic.copyDiagramSvg({ language, svg }).then((result) => {
      if (result.ok) {
        setTemporaryButtonText(button, "コピーしました", label);
        return;
      }

      setTemporaryButtonText(button, result.error.message, label);
    }).catch((error) => {
      setTemporaryButtonText(button, error instanceof Error ? error.message : "コピーできませんでした", label);
    });
  });

  return button;
}

function createDiagramOutputButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cm-live-diagram-output-button";
  button.textContent = label;

  button.addEventListener("pointerdown", stopDiagramOutputEvent);
  button.addEventListener("mousedown", stopDiagramOutputEvent);

  return button;
}

function stopDiagramOutputEvent(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function setTemporaryButtonText(button: HTMLButtonElement, text: string, fallback: string): void {
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = fallback;
  }, 1600);
}

function diagramIndexForBlock(content: string, blockFrom: number): number {
  let index = 0;

  for (const match of content.matchAll(/^```[ \t]*(mermaid|d2)(?:[ \t].*)?$/gim)) {
    index += 1;
    if (match.index !== undefined && match.index >= blockFrom) return index;
  }

  return Math.max(index, 1);
}
