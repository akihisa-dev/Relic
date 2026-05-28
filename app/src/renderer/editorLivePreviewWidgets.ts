import { WidgetType } from "@codemirror/view";

import { writeEditorClipboardText } from "./editorClipboard";

function stopWidgetButtonEvent(event: Event): void {
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
  constructor(
    private readonly checked: boolean,
    private readonly onToggle?: () => void
  ) {
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
    checkbox.setAttribute("aria-label", this.checked ? "チェックを外す" : "チェックする");
    checkbox.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.onToggle?.();
    });
    return checkbox;
  }

  ignoreEvent(event: Event): boolean {
    return ["click", "mousedown", "pointerdown", "change"].includes(event.type);
  }
}

export class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement("hr");
    hr.className = "cm-live-hr";
    return hr;
  }
}

export class CodeBlockHeaderWidget extends WidgetType {
  readonly className = "cm-live-code-block-header";

  constructor(
    private readonly language: string | null,
    private readonly source: string
  ) {
    super();
  }

  eq(other: CodeBlockHeaderWidget): boolean {
    return this.language === other.language && this.source === other.source;
  }

  toDOM(): HTMLElement {
    const header = document.createElement("div");
    header.className = this.className;
    header.contentEditable = "false";

    const label = document.createElement("span");
    label.className = "cm-live-code-block-label";
    label.textContent = this.language || "コード";

    const button = document.createElement("button");
    button.className = "cm-live-code-block-copy";
    button.type = "button";
    button.textContent = "コピー";
    button.setAttribute("aria-label", "コードブロックをコピー");
    button.addEventListener("pointerdown", stopWidgetButtonEvent);
    button.addEventListener("mousedown", stopWidgetButtonEvent);
    button.addEventListener("click", (event) => {
      stopWidgetButtonEvent(event);
      void writeEditorClipboardText(this.source)
        .then(() => setTemporaryButtonText(button, "コピーしました", "コピー"))
        .catch(() => setTemporaryButtonText(button, "コピーできませんでした", "コピー"));
    });

    header.append(label, button);
    return header;
  }

  ignoreEvent(event: Event): boolean {
    return ["click", "mousedown", "pointerdown"].includes(event.type);
  }
}

export class CodeBlockFooterWidget extends WidgetType {
  readonly className = "cm-live-code-block-footer";

  toDOM(): HTMLElement {
    const footer = document.createElement("div");
    footer.className = this.className;
    footer.contentEditable = "false";
    footer.setAttribute("aria-label", "コードブロックの終端");
    return footer;
  }
}
