import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { marked, type Renderer } from "marked";
import { useCallback, useMemo } from "react";
import type { MouseEvent, ReactElement } from "react";

import type { EditorSettings } from "../../shared/ipc";

interface PreviewProps {
  content: string;
  onChange?: (content: string) => void;
  settings: EditorSettings;
}

const fontFamilyMap: Record<EditorSettings["font"], string> = {
  mincho: '"Hiragino Mincho ProN", serif',
  mono: "Menlo, monospace",
  system: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif'
};

function buildRenderer(): Renderer {
  const renderer = new marked.Renderer();

  renderer.code = ({ lang, text }) => {
    const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
    const highlighted = hljs.highlight(text, { language }).value;

    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
  };

  return renderer;
}

const renderer = buildRenderer();

function toggleNthCheckbox(source: string, index: number): string {
  let count = -1;

  return source.replace(/^([ \t]*[-*+] \[)([ xX])(\])/gm, (match, before, state, after) => {
    count++;

    if (count !== index) return match;

    const next = state === " " ? "x" : " ";

    return `${before}${next}${after}`;
  });
}

export function Preview({ content, onChange, settings }: PreviewProps): ReactElement {
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false, renderer }) as string;
    // チェックボックスの disabled を外して操作可能にする
    const withCheckboxes = raw.replace(
      /<input disabled="" type="checkbox">/g,
      '<input type="checkbox" class="preview-checkbox">'
    ).replace(
      /<input checked="" disabled="" type="checkbox">/g,
      '<input checked type="checkbox" class="preview-checkbox">'
    );

    return DOMPurify.sanitize(withCheckboxes, { ADD_ATTR: ["checked", "class"] });
  }, [content]);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

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
    [content, onChange]
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
      className="preview-body"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
      style={style}
    />
  );
}
