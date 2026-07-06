import { WidgetType, type EditorView } from "@codemirror/view";
import katex from "katex";

import { writeEditorClipboardText } from "./editorClipboard";
import { sanitizePreviewHtml } from "./htmlSanitizer";
import type { Translator } from "./i18nModel";

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

  override eq(other: ListMarkerWidget): boolean {
    return this.label === other.label && this.className === other.className;
  }

  override toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.className = this.className;
    marker.textContent = this.label;
    return marker;
  }
}

export class InlineFormatWidget extends WidgetType {
  constructor(
    private readonly tagName: "span" | "strong" | "em" | "code" | "a" | "u" | "sup",
    private readonly text: string,
    private readonly className: string,
    private readonly onClick?: () => void,
    private readonly dataAttributes: Record<string, string> = {}
  ) {
    super();
  }

  override eq(other: InlineFormatWidget): boolean {
    return this.tagName === other.tagName &&
      this.text === other.text &&
      this.className === other.className &&
      JSON.stringify(this.dataAttributes) === JSON.stringify(other.dataAttributes);
  }

  override toDOM(): HTMLElement {
    const element = document.createElement(this.tagName);
    element.className = this.className;
    element.textContent = this.text;
    for (const [key, value] of Object.entries(this.dataAttributes)) {
      element.dataset[key] = value;
    }
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

  override ignoreEvent(event: Event): boolean {
    return Boolean(this.onClick && ["click", "mousedown", "pointerdown"].includes(event.type));
  }
}

export class ImageWidget extends WidgetType {
  readonly className = "cm-live-image";

  constructor(
    private readonly src: string,
    private readonly alt: string
  ) {
    super();
  }

  override eq(other: ImageWidget): boolean {
    return this.src === other.src && this.alt === other.alt;
  }

  override toDOM(): HTMLElement {
    const image = document.createElement("img");
    image.alt = this.alt;
    image.className = this.className;
    image.src = this.src;
    return image;
  }
}

function renderMathHtml(source: string, displayMode: boolean): string {
  try {
    return sanitizePreviewHtml(katex.renderToString(source, { displayMode, throwOnError: false }));
  } catch {
    const escaped = source
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<span class="math-error">${escaped}</span>`;
  }
}

export class MathWidget extends WidgetType {
  readonly className: string;

  constructor(
    private readonly source: string,
    private readonly displayMode: boolean
  ) {
    super();
    this.className = displayMode ? "cm-live-math-block" : "cm-live-math-inline";
  }

  override eq(other: MathWidget): boolean {
    return this.source === other.source && this.displayMode === other.displayMode;
  }

  override toDOM(): HTMLElement {
    const element = document.createElement(this.displayMode ? "div" : "span");
    element.className = this.className;
    // KaTeX returns math markup from a text source; the renderer does not accept raw HTML.
    element.innerHTML = renderMathHtml(this.source, this.displayMode);
    return element;
  }
}

export class FootnoteDefinitionMarkerWidget extends WidgetType {
  readonly className = "cm-live-footnote-def";

  constructor(private readonly id: string) {
    super();
  }

  override eq(other: FootnoteDefinitionMarkerWidget): boolean {
    return this.id === other.id;
  }

  override toDOM(): HTMLElement {
    const element = document.createElement("span");
    element.className = this.className;
    const marker = document.createElement("sup");
    marker.textContent = this.id;
    element.append(marker);
    return element;
  }
}

export class CheckboxWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly onToggle: (() => void) | undefined,
    private readonly t: Translator
  ) {
    super();
  }

  override eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked;
  }

  override toDOM(): HTMLElement {
    const checkbox = document.createElement("input");
    checkbox.className = "cm-live-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.setAttribute("aria-label", this.checked ? this.t("editor.checkboxUncheck") : this.t("editor.checkboxCheck"));
    checkbox.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.onToggle?.();
    });
    return checkbox;
  }

  override ignoreEvent(event: Event): boolean {
    return ["click", "mousedown", "pointerdown", "change"].includes(event.type);
  }
}

export class HorizontalRuleWidget extends WidgetType {
  override toDOM(): HTMLElement {
    const hr = document.createElement("hr");
    hr.className = "cm-live-hr";
    return hr;
  }
}

export class CodeBlockWidget extends WidgetType {
  readonly className = "cm-live-code-block-panel";

  constructor(
    private readonly language: string | null,
    private readonly source: string,
    private readonly revealPosition: number,
    private readonly t: Translator
  ) {
    super();
  }

  override eq(other: CodeBlockWidget): boolean {
    return this.language === other.language && this.source === other.source;
  }

  override toDOM(view: EditorView): HTMLElement {
    const panel = document.createElement("div");
    panel.className = this.className;
    panel.contentEditable = "false";
    panel.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement && event.target.closest("button")) return;
      view.dispatch({ selection: { anchor: this.revealPosition }, scrollIntoView: true });
    });

    const header = document.createElement("div");
    header.className = "cm-live-code-block-header";

    const label = document.createElement("span");
    label.className = "cm-live-code-block-label";
    label.textContent = this.language || this.t("editor.codeBlockLanguageFallback");

    const button = document.createElement("button");
    button.className = "cm-live-code-block-copy";
    button.type = "button";
    button.textContent = this.t("editor.copy");
    button.setAttribute("aria-label", this.t("editor.copyCodeBlock"));
    button.addEventListener("pointerdown", stopWidgetButtonEvent);
    button.addEventListener("mousedown", stopWidgetButtonEvent);
    button.addEventListener("click", (event) => {
      stopWidgetButtonEvent(event);
      void writeEditorClipboardText(this.source)
        .then(() => setTemporaryButtonText(button, this.t("editor.copyDone"), this.t("editor.copy")))
        .catch(() => setTemporaryButtonText(button, this.t("editor.copyFailed"), this.t("editor.copy")));
    });

    header.append(label, button);

    const pre = document.createElement("pre");
    pre.className = "cm-live-code-block-pre";

    const code = document.createElement("code");
    code.className = "cm-live-code-block-source";
    code.textContent = this.source;

    pre.append(code);
    panel.append(header, pre);

    return panel;
  }

  override ignoreEvent(event: Event): boolean {
    return ["click", "mousedown", "pointerdown"].includes(event.type);
  }
}
