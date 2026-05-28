import DOMPurify from "dompurify";
import hljs from "highlight.js";
import katex from "katex";
import { marked, type Renderer } from "marked";
import markedFootnote from "marked-footnote";

import type { Translator } from "./i18nModel";
import { diagramLanguageFor } from "./diagramLanguage";
import { encodeDiagramSourceAttribute } from "./diagramSourceAttribute";

export const maxEmbeddedFileLength = 20_000;

export type EmbedState =
  | { status: "loading" }
  | { status: "loaded"; content: string; name: string }
  | { status: "large"; name: string }
  | { status: "error"; message: string };

export function slugifyHeading(text: string): string {
  return encodeURIComponent(text.trim().toLowerCase().replace(/\s+/g, "-"));
}

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
        return `<button class="wikilink" data-target="${token.target}" type="button">${token.label}</button>`;
      }
    }
  ]
};

marked.use(mathExtension as Parameters<typeof marked.use>[0]);
marked.use(obsidianExtension as Parameters<typeof marked.use>[0]);
marked.use(markedFootnote());

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function sanitizePreviewHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["checked", "class", "data-diagram-language", "data-diagram-source", "data-target", "id"]
  });
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
    const diagramLanguage = diagramLanguageFor(lang);
    if (diagramLanguage) {
      const escaped = escapeHtml(text);
      const sourceAttribute = escapeHtmlAttribute(encodeDiagramSourceAttribute(text));

      return `<div class="preview-diagram preview-diagram--${diagramLanguage}" data-diagram-language="${diagramLanguage}" data-diagram-source="${sourceAttribute}"><pre><code class="language-${diagramLanguage}">${escaped}</code></pre></div>`;
    }

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

export function toggleNthCheckbox(source: string, index: number): string {
  let count = -1;

  return source.replace(/^([ \t]*[-*+] \[)([ xX])(\])/gm, (match, before, state, after) => {
    count++;

    if (count !== index) return match;

    const next = state === " " ? "x" : " ";

    return `${before}${next}${after}`;
  });
}

export function extractEmbedTargets(content: string): string[] {
  const targets = new Set<string>();

  for (const match of content.matchAll(/!\[\[([^\]\n]+)\]\]/g)) {
    const target = normalizeEmbedTarget(match[1]);

    if (target) targets.add(target);
  }

  return [...targets];
}

export function renderMarkdown(
  content: string,
  workspacePath: string | null | undefined,
  embeds: Map<string, EmbedState>,
  renderEmbeds: boolean,
  t: Translator
): string {
  const renderer = buildRenderer();
  const withEmbedPlaceholders = renderEmbeds
    ? content.replace(/!\[\[([^\]\n]+)\]\]/g, (match, rawTarget: string) => {
        const target = normalizeEmbedTarget(rawTarget);

        if (!target) {
          return `\n\n<div class="preview-file-embed preview-file-embed--error">${escapeHtml(match)}</div>\n\n`;
        }

        return `\n\n${renderFileEmbed(target, embeds, workspacePath, t)}\n\n`;
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
  const sanitized = sanitizePreviewHtml(withCheckboxes);

  return sanitized;
}

function renderFileEmbed(
  target: string,
  embeds: Map<string, EmbedState>,
  workspacePath: string | null | undefined,
  t: Translator
): string {
  const state = embeds.get(target) ?? { status: "loading" };

  if (state.status === "loading") {
    return `<div class="preview-file-embed preview-file-embed--loading">${escapeHtml(t("preview.embedLoading", { target }))}</div>`;
  }

  if (state.status === "error") {
    return `<div class="preview-file-embed preview-file-embed--error">${escapeHtml(state.message)}</div>`;
  }

  if (state.status === "large") {
    return `<div class="preview-file-embed preview-file-embed--large">${escapeHtml(t("preview.embedLarge", { name: state.name }))}</div>`;
  }

  const body = renderMarkdown(state.content, workspacePath, new Map(), false, t);

  return `<section class="preview-file-embed"><div class="preview-file-embed-title">${escapeHtml(state.name)}</div><div class="preview-file-embed-body">${body}</div></section>`;
}
