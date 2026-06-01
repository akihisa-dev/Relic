import { diagramLabel, type DiagramLanguage } from "./diagramLanguage";
import { createTranslator, type Translator } from "./i18nModel";

export function buildDiagramError(
  language: DiagramLanguage,
  source: string,
  error: unknown,
  t: Translator = createTranslator("system")
): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "preview-diagram-error";
  const errorText = error instanceof Error ? error.message : String(error);
  const label = diagramLabel(language);

  const title = document.createElement("div");
  title.className = "preview-diagram-error-title";
  title.textContent = t("diagram.renderFailed", { language: label });

  const message = document.createElement("div");
  message.className = "preview-diagram-error-message";
  message.textContent = t("diagram.syntaxHint");

  const sourceDetails = document.createElement("details");
  sourceDetails.className = "preview-diagram-error-details";
  const sourceSummary = document.createElement("summary");
  sourceSummary.textContent = t("diagram.showSource");
  const sourcePre = document.createElement("pre");
  const sourceCode = document.createElement("code");
  sourceCode.className = `language-${language}`;
  sourceCode.textContent = source;
  sourcePre.append(sourceCode);
  sourceDetails.append(sourceSummary, sourcePre, createDiagramErrorCopyButton(t("diagram.copySource"), source, t));

  const errorDetails = document.createElement("details");
  errorDetails.className = "preview-diagram-error-details";
  const errorSummary = document.createElement("summary");
  errorSummary.textContent = t("diagram.errorDetails");
  const errorPre = document.createElement("pre");
  errorPre.textContent = errorText;
  errorDetails.append(errorSummary, errorPre, createDiagramErrorCopyButton(t("diagram.copyErrorDetails"), errorText, t));

  panel.append(title, message, sourceDetails, errorDetails);
  return panel;
}

function createDiagramErrorCopyButton(label: string, text: string, t: Translator): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "preview-diagram-error-copy-button";
  button.textContent = label;

  const stopInteraction = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  button.addEventListener("pointerdown", stopInteraction);
  button.addEventListener("mousedown", stopInteraction);
  button.addEventListener("click", (event) => {
    stopInteraction(event);

    void navigator.clipboard?.writeText(text)
      .then(() => {
        button.textContent = t("editor.copyDone");
        window.setTimeout(() => {
          button.textContent = label;
        }, 1200);
      })
      .catch(() => {
        button.textContent = t("editor.copyFailed");
        window.setTimeout(() => {
          button.textContent = label;
        }, 1600);
      });
  });

  return button;
}
