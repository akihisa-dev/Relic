import { WidgetType } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

import { enterDiagramSourceEdit } from "./editorDiagramEditState";
import {
  buildDiagramFallback,
  renderDiagramElement,
  type DiagramLanguage,
  type DiagramRenderHandle
} from "./diagramPreview";

export class ListMarkerWidget extends WidgetType {
  constructor(
    private readonly label: string,
    private readonly className: string
  ) {
    super();
  }

  eq(other: ListMarkerWidget): boolean {
    return this.label === other.label && this.className === other.className;
  }

  toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.className = this.className;
    marker.textContent = this.label;
    return marker;
  }
}

export class InlineFormatWidget extends WidgetType {
  constructor(
    private readonly tagName: "span" | "strong" | "em" | "code" | "a" | "u",
    private readonly text: string,
    private readonly className: string,
    private readonly onClick?: () => void
  ) {
    super();
  }

  eq(other: InlineFormatWidget): boolean {
    return this.tagName === other.tagName && this.text === other.text && this.className === other.className;
  }

  toDOM(): HTMLElement {
    const element = document.createElement(this.tagName);
    element.className = this.className;
    element.textContent = this.text;
    if (this.onClick) {
      let opened = false;
      const openLink = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (opened) return;
        opened = true;
        this.onClick?.();
        window.setTimeout(() => {
          opened = false;
        }, 0);
      };
      element.addEventListener("pointerdown", openLink);
      element.addEventListener("mousedown", openLink);
      element.addEventListener("click", openLink);
    }
    if (this.className === "cm-live-bold") {
      element.style.display = "inline-block";
      element.style.fontWeight = "900";
      element.style.paddingInline = "0.015em";
      element.style.textShadow = "0.025em 0 0 currentColor";
    }
    if (this.className === "cm-live-italic") {
      element.style.display = "inline-block";
      element.style.fontStyle = "italic";
      element.style.transform = "skewX(-14deg)";
      element.style.transformOrigin = "baseline";
    }
    return element;
  }

  ignoreEvent(event: Event): boolean {
    return Boolean(this.onClick && ["click", "mousedown", "pointerdown"].includes(event.type));
  }
}

export class CheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked;
  }

  toDOM(): HTMLElement {
    const checkbox = document.createElement("input");
    checkbox.className = "cm-live-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.tabIndex = -1;
    return checkbox;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement("hr");
    hr.className = "cm-live-hr";
    return hr;
  }
}

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
