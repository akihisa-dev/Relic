import { relicClient } from "./relicClient";
import { WidgetType } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

import {
  buildDiagramFallback,
  createDiagramExpandButton,
  renderDiagramElement,
  type DiagramLanguage,
  type DiagramRenderHandle
} from "./diagramPreview";
import { getRenderedDiagramSvgText } from "./diagramSvg";
import { enterDiagramSourceEdit } from "./editorDiagramEditState";
import { createTranslator, type Translator } from "./i18nModel";
import { buildDiagramDefaultFileName } from "./outputHtml";

export class DiagramBlockWidget extends WidgetType {
  readonly className = "cm-live-diagram";

  constructor(
    private readonly source: string,
    private readonly language: DiagramLanguage,
    private readonly blockFrom: number,
    private readonly blockTo: number,
    private readonly editCursor: number,
    private readonly t: Translator = createTranslator("system")
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
    fitButton.textContent = this.t("diagram.fit");
    fitButton.setAttribute("aria-label", this.t("diagram.fitAria", { language: label }));
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
    editButton.textContent = this.t("diagram.editSource");
    editButton.setAttribute("aria-label", this.t("diagram.editSourceAria", { language: label }));
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
    void renderDiagramElement(diagram, this.language, this.source, this.t, { showExpandButton: false }).then((handle) => {
      diagramHandle = handle;
      fitButton.disabled = !handle;
      if (handle) {
        const renderedDiagram = diagram.querySelector<HTMLElement>(".preview-diagram-svg");
        if (renderedDiagram) {
          toolbar.append(createDiagramExpandButton(renderedDiagram, this.language, this.t));
        }
        toolbar.append(
          createDiagramSvgSaveButton(view, diagram, this.language, this.blockFrom, this.t),
          createDiagramSvgCopyButton(diagram, this.language, this.t)
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
  blockFrom: number,
  t: Translator
): HTMLButtonElement {
  const label = t("diagram.saveSvg");
  const button = createDiagramOutputButton(label);
  button.setAttribute("aria-label", t("diagram.saveSvgAria", { language: language === "d2" ? "D2" : "Mermaid" }));

  button.addEventListener("click", (event) => {
    stopDiagramOutputEvent(event);
    const svg = getRenderedDiagramSvgText(diagram);
    if (!svg || !relicClient.current) {
      setTemporaryButtonText(button, t("diagram.saveFailed"), label);
      return;
    }

    const fileName = view.dom
      .closest<HTMLElement>(".cm-editor-shell")
      ?.dataset.outputFileName;
    const diagramIndex = diagramIndexForBlock(view.state.doc.toString(), blockFrom);
    const defaultFileName = buildDiagramDefaultFileName(fileName, diagramIndex, language);

    void relicClient.current.saveDiagramSvg({ defaultFileName, language, svg }).then((result) => {
      if (result.ok && result.value.status === "saved") {
        setTemporaryButtonText(button, t("diagram.saveDone"), label);
        return;
      }

      if (result.ok && result.value.status === "canceled") return;

      setTemporaryButtonText(button, result.ok ? t("diagram.saveFailed") : result.error.message, label);
    }).catch((error) => {
      setTemporaryButtonText(button, error instanceof Error ? error.message : t("diagram.saveFailed"), label);
    });
  });

  return button;
}

function createDiagramSvgCopyButton(diagram: HTMLElement, language: DiagramLanguage, t: Translator): HTMLButtonElement {
  const label = t("diagram.copySvg");
  const button = createDiagramOutputButton(label);
  button.setAttribute("aria-label", t("diagram.copySvgAria", { language: language === "d2" ? "D2" : "Mermaid" }));

  button.addEventListener("click", (event) => {
    stopDiagramOutputEvent(event);
    const svg = getRenderedDiagramSvgText(diagram);
    if (!svg || !relicClient.current) {
      setTemporaryButtonText(button, t("editor.copyFailed"), label);
      return;
    }

    void relicClient.current.copyDiagramSvg({ language, svg }).then((result) => {
      if (result.ok) {
        setTemporaryButtonText(button, t("editor.copyDone"), label);
        return;
      }

      setTemporaryButtonText(button, result.error.message, label);
    }).catch((error) => {
      setTemporaryButtonText(button, error instanceof Error ? error.message : t("editor.copyFailed"), label);
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
