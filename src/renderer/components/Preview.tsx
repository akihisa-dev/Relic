import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";
import type { ReactElement } from "react";

import type { EditorSettings } from "../../shared/ipc";

interface PreviewProps {
  content: string;
  settings: EditorSettings;
}

const fontFamilyMap: Record<EditorSettings["font"], string> = {
  mincho: '"Hiragino Mincho ProN", serif',
  mono: "Menlo, monospace",
  system: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif'
};

export function Preview({ content, settings }: PreviewProps): ReactElement {
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false }) as string;

    return DOMPurify.sanitize(raw);
  }, [content]);

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
      className="preview-body"
      dangerouslySetInnerHTML={{ __html: html }}
      style={style}
    />
  );
}
