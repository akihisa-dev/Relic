import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { EditorSettings } from "../../shared/ipc";
import { appFontFamilyMap } from "../appFont";
import { usePreviewEmbeds } from "../hooks/usePreviewEmbeds";
import { sanitizePreviewHtml } from "../htmlSanitizer";
import { useT } from "../i18n";
import { renderDiagramElements } from "../diagramPreview";
import { renderMarkdown, slugifyHeading, toggleNthCheckbox } from "../previewMarkdown";
import { previewUpdateDelayMs } from "../previewUpdateScheduling";

interface PreviewProps {
  content: string;
  onChange?: (content: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  onScrollTargetHandled?: () => void;
  scrollTargetHeading?: string;
  settings: EditorSettings;
  workspacePath?: string | null;
}

export function Preview({
  content,
  onChange,
  onOpenWikiLink,
  onScrollTargetHandled,
  scrollTargetHeading,
  settings,
  workspacePath
}: PreviewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlePreviewActivationRef = useRef<(event: MouseEvent | KeyboardEvent) => void>(() => {});
  const onScrollTargetHandledRef = useRef(onScrollTargetHandled);
  const [previewContent, setPreviewContent] = useState(content);
  const embeds = usePreviewEmbeds(previewContent, workspacePath);
  const t = useT();

  useEffect(() => {
    const delay = previewUpdateDelayMs(content);

    if (delay === 0) {
      setPreviewContent(content);
      return;
    }

    const timer = window.setTimeout(() => setPreviewContent(content), delay);
    return () => window.clearTimeout(timer);
  }, [content]);

  const html = useMemo(() => {
    return renderMarkdown(previewContent, workspacePath, embeds, true, t);
  }, [embeds, previewContent, t, workspacePath]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = sanitizePreviewHtml(html);
    return renderDiagramElements(container, t);
  }, [html, settings.theme, t]);

  useEffect(() => {
    onScrollTargetHandledRef.current = onScrollTargetHandled;
  }, [onScrollTargetHandled]);

  useEffect(() => {
    if (!scrollTargetHeading || !containerRef.current) return;
    let handledTimer: ReturnType<typeof setTimeout> | undefined;

    const id = slugifyHeading(scrollTargetHeading);
    const headings = containerRef.current.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6");
    const el = Array.from(headings).find((heading) => heading.id === id);

    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      handledTimer = setTimeout(() => onScrollTargetHandledRef.current?.(), 0);
    }

    return () => {
      if (handledTimer) clearTimeout(handledTimer);
    };
  }, [scrollTargetHeading, html]);

  const handlePreviewActivation = useCallback(
    (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;

      const target = event.target as HTMLElement;
      const currentTarget = event.currentTarget;
      if (!(currentTarget instanceof HTMLDivElement)) return;

      const wikiLink = target.closest<HTMLElement>(".wikilink");

      if (wikiLink?.dataset.target && onOpenWikiLink) {
        event.preventDefault();
        const fullTarget = wikiLink.dataset.target;
        const hashIndex = fullTarget.indexOf("#");

        if (hashIndex >= 0) {
          onOpenWikiLink(fullTarget.slice(0, hashIndex), fullTarget.slice(hashIndex + 1));
        } else {
          onOpenWikiLink(fullTarget);
        }

        return;
      }

      if (target.tagName !== "INPUT" || (target as HTMLInputElement).type !== "checkbox") return;

      event.preventDefault();

      if (!onChange) return;

      const checkboxes = currentTarget.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      const index = Array.from(checkboxes).indexOf(target as HTMLInputElement);

      if (index === -1) return;

      onChange(toggleNthCheckbox(content, index));
    },
    [content, onChange, onOpenWikiLink]
  );

  useEffect(() => {
    handlePreviewActivationRef.current = handlePreviewActivation;
  }, [handlePreviewActivation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handlePreviewEvent = (event: MouseEvent | KeyboardEvent): void => {
      handlePreviewActivationRef.current(event);
    };

    container.addEventListener("click", handlePreviewEvent);
    container.addEventListener("keydown", handlePreviewEvent);

    return () => {
      container.removeEventListener("click", handlePreviewEvent);
      container.removeEventListener("keydown", handlePreviewEvent);
    };
  }, []);

  const style: React.CSSProperties = {
    fontFamily: appFontFamilyMap[settings.font],
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    maxWidth: settings.maxWidth === "none" ? "none" : settings.maxWidth,
    margin: "0 auto",
    padding: "24px 32px",
    height: "100%",
    overflowY: "auto"
  };

  return (
    <div
      ref={containerRef}
      className="preview-body"
      style={style}
    />
  );
}
