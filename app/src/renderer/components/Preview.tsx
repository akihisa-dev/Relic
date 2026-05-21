import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MouseEvent, ReactElement } from "react";

import type { EditorSettings } from "../../shared/ipc";
import { usePreviewEmbeds } from "../hooks/usePreviewEmbeds";
import { useT } from "../i18n";
import { renderMarkdown, slugifyHeading, toggleNthCheckbox } from "../previewMarkdown";

export { normalizeEmbedTarget } from "../previewMarkdown";

interface PreviewProps {
  content: string;
  onChange?: (content: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  onScrollTargetHandled?: () => void;
  scrollTargetHeading?: string;
  settings: EditorSettings;
  cardbookPath?: string | null;
}

const fontFamilyMap: Record<EditorSettings["font"], string> = {
  mincho: '"Hiragino Mincho ProN", serif',
  mono: "Menlo, monospace",
  system: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif'
};

export function Preview({
  content,
  onChange,
  onOpenWikiLink,
  onScrollTargetHandled,
  scrollTargetHeading,
  settings,
  cardbookPath
}: PreviewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const embeds = usePreviewEmbeds(content, cardbookPath);
  const t = useT();

  const html = useMemo(() => {
    return renderMarkdown(content, cardbookPath, embeds, true, t);
  }, [content, embeds, t, cardbookPath]);

  useEffect(() => {
    if (!scrollTargetHeading || !containerRef.current) return;

    const id = slugifyHeading(scrollTargetHeading);
    const headings = containerRef.current.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6");
    const el = Array.from(headings).find((heading) => heading.id === id);

    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      onScrollTargetHandled?.();
    }
  }, [scrollTargetHeading, html, onScrollTargetHandled]);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const wikiLink = target.closest<HTMLElement>(".wikilink");

      if (wikiLink?.dataset.target && onOpenWikiLink) {
        e.preventDefault();
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

      e.preventDefault();

      if (!onChange) return;

      const checkboxes = (e.currentTarget as HTMLDivElement).querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]'
      );
      const index = Array.from(checkboxes).indexOf(target as HTMLInputElement);

      if (index === -1) return;

      onChange(toggleNthCheckbox(content, index));
    },
    [content, onChange, onOpenWikiLink]
  );

  const style: React.CSSProperties = {
    fontFamily: fontFamilyMap[settings.font],
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
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
      style={style}
    />
  );
}
