import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import type { AliasIndex } from "../../shared/links";
import { resolveWikiLinkPathWithAliases } from "../../shared/links";
import { sanitizePreviewHtml } from "../htmlSanitizer";
import { useT } from "../i18n";
import { renderMarkdown } from "../previewMarkdown";

interface PagePreviewPopoverProps {
  aliasesByPath: AliasIndex;
  existingMarkdownPaths: string[];
}

interface PreviewState {
  content: string | null;
  error: string | null;
  isLoading: boolean;
  path: string;
  x: number;
  y: number;
}

const previewDelayMs = 240;
const popoverWidth = 360;
const popoverHeight = 280;

export function PagePreviewPopover({
  aliasesByPath,
  existingMarkdownPaths
}: PagePreviewPopoverProps): ReactElement | null {
  const t = useT();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const existingPathSet = useMemo(() => new Set(existingMarkdownPaths), [existingMarkdownPaths]);

  useEffect(() => {
    const clearTimer = (): void => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const hide = (): void => {
      clearTimer();
      requestIdRef.current += 1;
      setPreview(null);
    };
    const schedule = (target: EventTarget | null, clientX: number, clientY: number): void => {
      if (!(target instanceof Element)) return;

      const link = target.closest<HTMLElement>("[data-preview-target][data-preview-source-path]");
      const sourcePath = link?.dataset.previewSourcePath;
      const linkTarget = link?.dataset.previewTarget;
      if (!link || !sourcePath || !linkTarget) return;

      clearTimer();
      const path = resolveWikiLinkPathWithAliases(linkTarget, sourcePath, existingMarkdownPaths, aliasesByPath);
      const x = Math.min(clientX + 14, Math.max(12, window.innerWidth - popoverWidth - 12));
      const y = Math.min(clientY + 14, Math.max(12, window.innerHeight - popoverHeight - 12));
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      timerRef.current = setTimeout(() => {
        if (!existingPathSet.has(path) || !window.relic) {
          setPreview({ content: null, error: t("preview.pageMissing"), isLoading: false, path, x, y });
          return;
        }

        setPreview({ content: null, error: null, isLoading: true, path, x, y });
        void window.relic.readMarkdownFile({ path }).then((result) => {
          if (requestIdRef.current !== requestId) return;
          if (result.ok) {
            setPreview({ content: result.value.content, error: null, isLoading: false, path, x, y });
          } else {
            setPreview({ content: null, error: result.error.message, isLoading: false, path, x, y });
          }
        }).catch((reason) => {
          if (requestIdRef.current !== requestId) return;
          setPreview({
            content: null,
            error: reason instanceof Error ? reason.message : String(reason),
            isLoading: false,
            path,
            x,
            y
          });
        });
      }, previewDelayMs);
    };
    const handlePointerOver = (event: PointerEvent): void => schedule(event.target, event.clientX, event.clientY);
    const handleFocusIn = (event: FocusEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const rect = target.getBoundingClientRect();
      schedule(target, rect.right, rect.top);
    };
    const handlePointerOut = (event: PointerEvent): void => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Element && nextTarget.closest(".page-preview-popover")) return;
      if (event.target instanceof Element && event.target.closest("[data-preview-target]")) hide();
    };

    window.addEventListener("pointerover", handlePointerOver, true);
    window.addEventListener("focusin", handleFocusIn, true);
    window.addEventListener("pointerout", handlePointerOut, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("keydown", hide, true);

    return () => {
      clearTimer();
      window.removeEventListener("pointerover", handlePointerOver, true);
      window.removeEventListener("focusin", handleFocusIn, true);
      window.removeEventListener("pointerout", handlePointerOut, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("keydown", hide, true);
    };
  }, [aliasesByPath, existingMarkdownPaths, existingPathSet, t]);

  if (!preview) return null;

  const html = preview.content
    ? sanitizePreviewHtml(renderMarkdown(preview.content, null, new Map(), false, t))
    : "";

  return (
    <aside
      aria-label={t("preview.pagePreview")}
      className="page-preview-popover"
      style={{ left: preview.x, top: preview.y }}
    >
      <div className="page-preview-title" title={preview.path}>{preview.path}</div>
      {preview.isLoading ? (
        <div className="page-preview-note">{t("common.loading")}</div>
      ) : preview.error ? (
        <div className="page-preview-note">{preview.error}</div>
      ) : (
        <div className="page-preview-body" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </aside>
  );
}
