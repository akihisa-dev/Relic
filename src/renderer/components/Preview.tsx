import DOMPurify from "dompurify";
import hljs from "highlight.js";
import katex from "katex";
import { marked, type Renderer } from "marked";
import { useCallback, useMemo } from "react";
import type { MouseEvent, ReactElement } from "react";

import type { EditorSettings } from "../../shared/ipc";

interface PreviewProps {
  content: string;
  onChange?: (content: string) => void;
  settings: EditorSettings;
  workspacePath?: string | null;
}

const fontFamilyMap: Record<EditorSettings["font"], string> = {
  mincho: '"Hiragino Mincho ProN", serif',
  mono: "Menlo, monospace",
  system: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif'
};

function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false });
  } catch {
    return `<span class="math-error">${tex}</span>`;
  }
}

// $...$ / $$...$$ をKaTeXでレンダリングするmarked拡張
const mathExtension = {
  extensions: [
    {
      name: "mathBlock",
      level: "block" as const,
      start: (src: string) => src.indexOf("$$"),
      tokenizer(src: string) {
        const match = /^\$\$([^$]+)\$\$/.exec(src);

        if (match) {
          return { type: "mathBlock", raw: match[0], text: match[1].trim() };
        }
      },
      renderer(token: { text: string }) {
        return `<div class="math-block">${renderMath(token.text, true)}</div>`;
      }
    },
    {
      name: "mathInline",
      level: "inline" as const,
      start: (src: string) => src.indexOf("$"),
      tokenizer(src: string) {
        const match = /^\$([^$\n]+)\$/.exec(src);

        if (match) {
          return { type: "mathInline", raw: match[0], text: match[1].trim() };
        }
      },
      renderer(token: { text: string }) {
        return `<span class="math-inline">${renderMath(token.text, false)}</span>`;
      }
    }
  ]
};

// ==ハイライト== と [[wikilink]] のObsidian互換拡張
const obsidianExtension = {
  extensions: [
    {
      name: "highlight",
      level: "inline" as const,
      start: (src: string) => src.indexOf("=="),
      tokenizer(src: string) {
        const match = /^==([^=]+)==/.exec(src);

        if (match) return { type: "highlight", raw: match[0], text: match[1] };
      },
      renderer(token: { text: string }) {
        return `<mark>${token.text}</mark>`;
      }
    },
    {
      name: "wikilink",
      level: "inline" as const,
      start: (src: string) => src.indexOf("[["),
      tokenizer(src: string) {
        const match = /^\[\[([^\]]+)\]\]/.exec(src);

        if (match) {
          const parts = match[1].split("|");
          return { type: "wikilink", raw: match[0], label: parts[1] ?? parts[0], target: parts[0] };
        }
      },
      renderer(token: { label: string; target: string }) {
        return `<span class="wikilink" data-target="${token.target}">${token.label}</span>`;
      }
    }
  ]
};

marked.use(mathExtension as Parameters<typeof marked.use>[0]);
marked.use(obsidianExtension as Parameters<typeof marked.use>[0]);

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveAttachmentImageSrc(
  workspacePath: string | null | undefined,
  href: string
): string | null {
  if (!workspacePath) return null;

  const trimmed = href.trim();

  if (
    trimmed === "" ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return null;
  }

  const normalized = trimmed.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);

  if (segments[0] !== "attachments" || segments.some((segment) => segment === "..")) {
    return null;
  }

  const extension = normalized.match(/\.[^.?#/]+(?=$|[?#])/)?.[0].toLowerCase();

  if (!extension || !imageExtensions.has(extension)) {
    return null;
  }

  return `file://${encodeURI(`${workspacePath.replace(/\/+$/, "")}/${normalized}`)}`;
}

function buildRenderer(workspacePath: string | null | undefined, imageSources: string[]): Renderer {
  const renderer = new marked.Renderer();

  renderer.code = ({ lang, text }) => {
    const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
    const highlighted = hljs.highlight(text, { language }).value;

    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
  };

  renderer.image = ({ href, title, text }) => {
    const src = resolveAttachmentImageSrc(workspacePath, href);
    const alt = escapeHtml(text ?? "");

    if (!src) {
      return `<span class="preview-image-placeholder">${alt || escapeHtml(href)}</span>`;
    }

    const imageId = imageSources.push(src) - 1;
    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";

    return `<img class="preview-attachment-image" data-relic-image-id="${imageId}" alt="${alt}"${titleAttribute}>`;
  };

  return renderer;
}


function toggleNthCheckbox(source: string, index: number): string {
  let count = -1;

  return source.replace(/^([ \t]*[-*+] \[)([ xX])(\])/gm, (match, before, state, after) => {
    count++;

    if (count !== index) return match;

    const next = state === " " ? "x" : " ";

    return `${before}${next}${after}`;
  });
}

export function Preview({ content, onChange, settings, workspacePath }: PreviewProps): ReactElement {
  const html = useMemo(() => {
    const imageSources: string[] = [];
    const renderer = buildRenderer(workspacePath, imageSources);
    const raw = marked.parse(content, { async: false, renderer }) as string;
    // チェックボックスの disabled を外して操作可能にする
    const withCheckboxes = raw.replace(
      /<input disabled="" type="checkbox">/g,
      '<input type="checkbox" class="preview-checkbox">'
    ).replace(
      /<input checked="" disabled="" type="checkbox">/g,
      '<input checked type="checkbox" class="preview-checkbox">'
    );

    const sanitized = DOMPurify.sanitize(withCheckboxes, { ADD_ATTR: ["checked", "class"] });

    return imageSources.reduce(
      (htmlWithImages, src, imageId) =>
        htmlWithImages.replace(`data-relic-image-id="${imageId}"`, `src="${src}"`),
      sanitized
    );
  }, [content, workspacePath]);

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
