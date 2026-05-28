import { diagramLabel, type DiagramLanguage } from "./diagramLanguage";

export function buildDiagramError(language: DiagramLanguage, source: string, error: unknown): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "preview-diagram-error";
  const errorText = error instanceof Error ? error.message : String(error);

  const title = document.createElement("div");
  title.className = "preview-diagram-error-title";
  title.textContent = `${diagramLabel(language)}をレンダリングできませんでした`;

  const message = document.createElement("div");
  message.className = "preview-diagram-error-message";
  message.textContent = "構文を確認してください。";

  const sourceDetails = document.createElement("details");
  sourceDetails.className = "preview-diagram-error-details";
  const sourceSummary = document.createElement("summary");
  sourceSummary.textContent = "元ソースを表示";
  const sourcePre = document.createElement("pre");
  const sourceCode = document.createElement("code");
  sourceCode.className = `language-${language}`;
  sourceCode.textContent = source;
  sourcePre.append(sourceCode);
  sourceDetails.append(sourceSummary, sourcePre, createDiagramErrorCopyButton("元ソースをコピー", source));

  const errorDetails = document.createElement("details");
  errorDetails.className = "preview-diagram-error-details";
  const errorSummary = document.createElement("summary");
  errorSummary.textContent = "詳細エラー";
  const errorPre = document.createElement("pre");
  errorPre.textContent = errorText;
  errorDetails.append(errorSummary, errorPre, createDiagramErrorCopyButton("詳細エラーをコピー", errorText));

  panel.append(title, message, sourceDetails, errorDetails);
  return panel;
}

function createDiagramErrorCopyButton(label: string, text: string): HTMLButtonElement {
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
        button.textContent = "コピーしました";
        window.setTimeout(() => {
          button.textContent = label;
        }, 1200);
      })
      .catch(() => {
        button.textContent = "コピーできませんでした";
        window.setTimeout(() => {
          button.textContent = label;
        }, 1600);
      });
  });

  return button;
}
