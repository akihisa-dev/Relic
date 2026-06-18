import { type ReactElement, useMemo, useState } from "react";

import { parseRelicDiagramMarkdown, type RelicConnectedDiagramDocument } from "../../../shared/diagramMarkdown";
import { type RelicError } from "../../../shared/result";
import { useT } from "../../i18n";
import { type Translator } from "../../i18nModel";
import { DiagramCanvasSurface } from "./DiagramCanvasSurface";
import { type DiagramCanvasProps } from "./diagramTypes";

export function DiagramCanvasRouter({ content, fileName, onChange, onSourceModeToggle }: DiagramCanvasProps): ReactElement {
  const parsed = useMemo(() => parseRelicDiagramMarkdown(content), [content]);

  if (!parsed.ok) {
    return <DiagramParseErrorView error={parsed.error} onSourceModeToggle={onSourceModeToggle} />;
  }

  return (
    <DiagramCanvasSurface
      content={content}
      diagram={parsed.value as RelicConnectedDiagramDocument}
      fileName={fileName}
      onChange={onChange}
    />
  );
}

function DiagramParseErrorView({
  error,
  onSourceModeToggle
}: {
  error: RelicError;
  onSourceModeToggle?: () => void;
}): ReactElement {
  const t = useT();
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  const location = diagramErrorLocation(error.details);
  const detailText = [
    `code: ${error.code}`,
    `message: ${error.message}`,
    location ? `line: ${location.line}, column: ${location.column}` : null,
    error.details ? `details:\n${error.details}` : null
  ].filter(Boolean).join("\n");

  const copyDetails = (): void => {
    if (!navigator.clipboard) {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1600);
      return;
    }

    void navigator.clipboard.writeText(detailText)
      .then(() => {
        setCopyState("done");
        window.setTimeout(() => setCopyState("idle"), 1200);
      })
      .catch(() => {
        setCopyState("failed");
        window.setTimeout(() => setCopyState("idle"), 1600);
      });
  };

  return (
    <div className="diagram-canvas diagram-canvas--invalid" role="alert">
      <div className="diagram-parse-error">
        <p className="diagram-parse-error-title">{t("diagram.invalidFile")}</p>
        <p className="diagram-parse-error-summary">{diagramErrorSummary(error.code, t)}</p>
        <dl className="diagram-parse-error-meta">
          <div>
            <dt>{t("diagram.errorCode")}</dt>
            <dd>{error.code}</dd>
          </div>
          <div>
            <dt>{t("diagram.errorKind")}</dt>
            <dd>{diagramErrorKind(error.code, t)}</dd>
          </div>
          {location ? (
            <div>
              <dt>{t("diagram.errorLocation")}</dt>
              <dd>{t("diagram.errorLineColumn", { line: location.line, column: location.column })}</dd>
            </div>
          ) : null}
        </dl>
        <p className="diagram-parse-error-message">{error.message}</p>
        <details className="diagram-parse-error-details">
          <summary>{t("diagram.errorDetails")}</summary>
          <pre>{detailText}</pre>
        </details>
        <div className="diagram-parse-error-actions">
          <button className="secondary-button" onClick={copyDetails} type="button">
            {copyState === "done"
              ? t("editor.copyDone")
              : copyState === "failed"
                ? t("editor.copyFailed")
                : t("diagram.copyErrorDetails")}
          </button>
          {onSourceModeToggle ? (
            <button className="primary-button" onClick={onSourceModeToggle} type="button">
              {t("diagram.openSourceMode")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function diagramErrorKind(code: string, t: Translator): string {
  if (code.includes("YAML")) return t("diagram.errorKindYaml");
  if (code === "DIAGRAM_FORMAT_VERSION_UNSUPPORTED") return t("diagram.errorKindFutureVersion");
  if (code.includes("UNKNOWN_FIELD")) return t("diagram.errorKindUnknownField");
  if (code.includes("LINE") || code.includes("NODE")) return t("diagram.errorKindRelation");
  return t("diagram.errorKindFormat");
}

function diagramErrorSummary(code: string, t: Translator): string {
  if (code === "DIAGRAM_FORMAT_VERSION_UNSUPPORTED") return t("diagram.errorSummaryFutureVersion");
  if (code.includes("YAML")) return t("diagram.errorSummaryYaml");
  if (code.includes("UNKNOWN_FIELD")) return t("diagram.errorSummaryUnknownField");
  if (code.includes("LINE_NODE_MISSING")) return t("diagram.errorSummaryMissingNode");
  if (code.includes("LINE") || code.includes("NODE")) return t("diagram.errorSummaryRelation");
  return t("diagram.errorSummaryFormat");
}

function diagramErrorLocation(details: string | undefined): { column: number; line: number } | null {
  if (!details) return null;

  const parenthesized = details.match(/\((\d+):(\d+)\)/);
  if (parenthesized?.[1] && parenthesized[2]) {
    return { line: Number(parenthesized[1]), column: Number(parenthesized[2]) };
  }

  const verbose = details.match(/line\s+(\d+),\s*column\s+(\d+)/i);
  if (verbose?.[1] && verbose[2]) {
    return { line: Number(verbose[1]), column: Number(verbose[2]) };
  }

  return null;
}
