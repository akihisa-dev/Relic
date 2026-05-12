import DOMPurify from "dompurify";
import hljs from "highlight.js";
import katex from "katex";
import { marked, type Renderer } from "marked";
import markedFootnote from "marked-footnote";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, ReactElement } from "react";

import type { EditorSettings } from "../../shared/ipc";

interface PreviewProps {
  content: string;
  onChange?: (content: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  onScrollTargetHandled?: () => void;
  scrollTargetHeading?: string;
  settings: EditorSettings;
  workspacePath?: string | null;
}

function slugifyHeading(text: string): string {
  return encodeURIComponent(text.trim().toLowerCase().replace(/\s+/g, "-"));
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
marked.use(markedFootnote());

const maxEmbeddedFileLength = 20_000;

type EmbedState =
  | { status: "loading" }
  | { status: "loaded"; content: string; name: string }
  | { status: "large"; name: string }
  | { status: "error"; message: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function normalizeEmbedTarget(target: string): string | null {
  const normalized = target.trim().split("#")[0].split("^")[0].replace(/\\/g, "/");

  if (
    normalized === "" ||
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.split("/").some((segment) => segment === "..") ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalized)
  ) {
    return null;
  }

  const extension = normalized.match(/\.[^.?#/]+(?=$|[?#])/)?.[0].toLowerCase();

  if (extension && extension !== ".md") {
    return null;
  }

  return normalized.endsWith(".md") ? normalized : `${normalized}.md`;
}

function buildRenderer(): Renderer {
  const renderer = new marked.Renderer();

  renderer.code = ({ lang, text }) => {
    const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
    const highlighted = hljs.highlight(text, { language }).value;

    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
  };

  renderer.heading = ({ depth, text }: { depth: number; text: string }) => {
    const plainText = text.replace(/<[^>]+>/g, "");
    const id = slugifyHeading(plainText);

    return `<h${depth} id="${escapeHtml(id)}">${text}</h${depth}>\n`;
  };

  renderer.image = ({ href, title, text }) => {
    const alt = escapeHtml(text ?? "");
    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";

    return `<span class="preview-image-placeholder"${titleAttribute}>${alt || escapeHtml(href)}</span>`;
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

function extractEmbedTargets(content: string): string[] {
  const targets = new Set<string>();

  for (const match of content.matchAll(/!\[\[([^\]\n]+)\]\]/g)) {
    const target = normalizeEmbedTarget(match[1]);

    if (target) targets.add(target);
  }

  return [...targets];
}

function renderMarkdown(
  content: string,
  workspacePath: string | null | undefined,
  embeds: Map<string, EmbedState>,
  renderEmbeds: boolean
): string {
  const renderer = buildRenderer();
  const withEmbedPlaceholders = renderEmbeds
    ? content.replace(/!\[\[([^\]\n]+)\]\]/g, (match, rawTarget: string) => {
        const target = normalizeEmbedTarget(rawTarget);

        if (!target) {
          return `\n\n<div class="preview-file-embed preview-file-embed--error">${escapeHtml(match)}</div>\n\n`;
        }

        return `\n\n${renderFileEmbed(target, embeds, workspacePath)}\n\n`;
      })
    : content.replace(/!\[\[([^\]\n]+)\]\]/g, "[[$1]]");
  const raw = marked.parse(withEmbedPlaceholders, { async: false, renderer }) as string;
  // チェックボックスの disabled を外して操作可能にする
  const withCheckboxes = raw.replace(
    /<input disabled="" type="checkbox">/g,
    '<input type="checkbox" class="preview-checkbox">'
  ).replace(
    /<input checked="" disabled="" type="checkbox">/g,
    '<input checked type="checkbox" class="preview-checkbox">'
  );
  const sanitized = DOMPurify.sanitize(withCheckboxes, {
    ADD_ATTR: ["checked", "class", "data-target", "id"]
  });

  return sanitized;
}

function renderFileEmbed(
  target: string,
  embeds: Map<string, EmbedState>,
  workspacePath: string | null | undefined
): string {
  const state = embeds.get(target) ?? { status: "loading" };

  if (state.status === "loading") {
    return `<div class="preview-file-embed preview-file-embed--loading">${escapeHtml(target)} を読み込んでいます</div>`;
  }

  if (state.status === "error") {
    return `<div class="preview-file-embed preview-file-embed--error">${escapeHtml(state.message)}</div>`;
  }

  if (state.status === "large") {
    return `<div class="preview-file-embed preview-file-embed--large">${escapeHtml(state.name)} は大きいため全文表示しません</div>`;
  }

  const body = renderMarkdown(state.content, workspacePath, new Map(), false);

  return `<section class="preview-file-embed"><div class="preview-file-embed-title">${escapeHtml(state.name)}</div><div class="preview-file-embed-body">${body}</div></section>`;
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
  const [embeds, setEmbeds] = useState<Map<string, EmbedState>>(new Map());

  useEffect(() => {
    const targets = extractEmbedTargets(content);

    if (targets.length === 0 || !window.relic) {
      setEmbeds(new Map());
      return;
    }

    let canceled = false;
    setEmbeds(new Map(targets.map((target) => [target, { status: "loading" } as EmbedState])));

    void Promise.all(
      targets.map(async (target) => {
        const result = await window.relic!.readMarkdownFile({ path: target });

        if (!result.ok) {
          return [target, { status: "error", message: result.error.message } as EmbedState] as const;
        }

        if (result.value.content.length > maxEmbeddedFileLength) {
          return [target, { status: "large", name: result.value.name } as EmbedState] as const;
        }

        return [
          target,
          { status: "loaded", content: result.value.content, name: result.value.name } as EmbedState
        ] as const;
      })
    ).then((entries) => {
      if (!canceled) setEmbeds(new Map(entries));
    });

    return () => {
      canceled = true;
    };
  }, [content, workspacePath]);

  const html = useMemo(() => {
    return renderMarkdown(content, workspacePath, embeds, true);
  }, [content, embeds, workspacePath]);

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
