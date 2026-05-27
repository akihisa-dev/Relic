import { WidgetType } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

import { enterMermaidSourceEdit } from "./editorMermaidEditState";
import { hashMermaidSource } from "./mermaidFlowchart";
import { dispatchMermaidVisualEditRequest } from "./mermaidVisualEditEvent";
import { buildMermaidFallback, renderMermaidElement, type MermaidRenderHandle } from "./mermaidPreview";

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

export class MermaidBlockWidget extends WidgetType {
  readonly className = "cm-live-mermaid";

  constructor(
    private readonly source: string,
    private readonly blockIndex: number,
    private readonly blockFrom: number,
    private readonly blockTo: number,
    private readonly editCursor: number
  ) {
    super();
  }

  eq(other: MermaidBlockWidget): boolean {
    return this.source === other.source &&
      this.blockIndex === other.blockIndex &&
      this.blockFrom === other.blockFrom &&
      this.blockTo === other.blockTo &&
      this.editCursor === other.editCursor;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("div");
    container.className = "preview-mermaid cm-live-mermaid";

    let mermaidHandle: MermaidRenderHandle | null = null;
    const toolbar = document.createElement("div");
    toolbar.className = "cm-live-mermaid-toolbar";
    const fitButton = document.createElement("button");
    fitButton.type = "button";
    fitButton.className = "cm-live-mermaid-fit-button";
    fitButton.textContent = "全体表示";
    fitButton.setAttribute("aria-label", "Mermaid図を全体表示");
    fitButton.disabled = true;
    fitButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      mermaidHandle?.fitToViewport();
    });

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "cm-live-mermaid-edit-button";
    editButton.textContent = "ソースを編集";
    editButton.setAttribute("aria-label", "Mermaidソースを編集");
    editButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      enterMermaidSourceEdit(
        view,
        { from: this.blockFrom, to: this.blockTo },
        this.editCursor
      );
    });

    const visualEditButton = document.createElement("button");
    visualEditButton.type = "button";
    visualEditButton.className = "cm-live-mermaid-visual-edit-button";
    visualEditButton.textContent = "Mermaidを図で編集";
    visualEditButton.setAttribute("aria-label", "このMermaidブロックを図から編集");
    visualEditButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      dispatchMermaidVisualEditRequest(container, {
        blockIndex: this.blockIndex,
        blockFrom: this.blockFrom,
        blockTo: this.blockTo,
        editCursor: this.editCursor,
        source: this.source,
        sourceHash: hashMermaidSource(this.source)
      });
    });
    toolbar.append(fitButton, visualEditButton, editButton);

    const diagram = document.createElement("div");
    diagram.className = "cm-live-mermaid-diagram";
    diagram.append(buildMermaidFallback(this.source));
    void renderMermaidElement(diagram, this.source).then((handle) => {
      mermaidHandle = handle;
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
