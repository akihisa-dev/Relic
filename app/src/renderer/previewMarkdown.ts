import hljs from "highlight.js";
import katex from "katex";
import { marked, type Renderer } from "marked";
import markedFootnote from "marked-footnote";

import { ensureMarkdownExtension } from "../shared/markdownExtension";
import type { Translator } from "./i18nModel";
import { diagramLanguageFor } from "./diagramLanguage";
import { encodeDiagramSourceAttribute } from "./diagramSourceAttribute";
import { isSafePreviewUrl, sanitizePreviewHtml } from "./htmlSanitizer";
import { formatWikiLinkTargetReference, parseWikiLinkBody, scanWikiLinks } from "../shared/links";

export const maxEmbeddedFileLength = 20_000;

const MARKDOWN_EXTENSIONS_REGISTERED = Symbol.for("relic.previewMarkdown.extensionsRegistered");
const maxPreviewCacheEntries = 12;
const maxHighlightCacheEntries = 80;
const maxMathCacheEntries = 80;
const previewRenderCache = new Map<string, string>();
const highlightCache = new Map<string, string>();
const mathCache = new Map<string, string>();
const supportedPreviewImageExtensions = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp"
]);

export type EmbedState =
  | { status: "loading" }
  | { status: "loaded"; content: string; name: string }
  | { status: "large"; name: string }
  | { status: "error"; message: string };

export function slugifyHeading(text: string): string {
  return encodeURIComponent(text.trim().toLowerCase().replace(/\s+/g, "-"));
}

function renderMath(tex: string, displayMode: boolean): string {
  const cacheKey = `${displayMode ? "block" : "inline"}\n${tex}`;
  const cached = mathCache.get(cacheKey);

  if (cached) return cached;

  try {
    const rendered = katex.renderToString(tex, { displayMode, throwOnError: false });
    rememberCacheEntry(mathCache, cacheKey, rendered, maxMathCacheEntries);
    return rendered;
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
          return { type: "mathBlock", raw: match[0], text: (match[1] ?? "").trim() };
        }

        return undefined;
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
          return { type: "mathInline", raw: match[0], text: (match[1] ?? "").trim() };
        }

        return undefined;
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
      name: "unsafeLink",
      level: "inline" as const,
      start: (src: string) => src.indexOf("["),
      tokenizer(src: string) {
        const match = /^\[([^\]\n]+)\]\(((?:javascript|file):[^\n]*)\)/i.exec(src);

        if (match) return { type: "unsafeLink", raw: match[0], text: match[1] ?? "" };
        return undefined;
      },
      renderer(token: { text: string }) {
        return escapeHtml(token.text);
      }
    },
    {
      name: "highlight",
      level: "inline" as const,
      start: (src: string) => src.indexOf("=="),
      tokenizer(src: string) {
        const match = /^==([^=]+)==/.exec(src);

        if (match) return { type: "highlight", raw: match[0], text: match[1] ?? "" };
        return undefined;
      },
      renderer(token: { text: string }) {
        return `<mark>${escapeHtml(token.text)}</mark>`;
      }
    },
    {
      name: "wikilink",
      level: "inline" as const,
      start: (src: string) => src.indexOf("[["),
      tokenizer(src: string) {
        const match = /^\[\[([^\]]+)\]\]/.exec(src);

        if (match) {
          const parsed = parseWikiLinkBody(match[1] ?? "");
          if (!parsed) return undefined;
          const target = formatWikiLinkTargetReference(parsed);
          return { type: "wikilink", raw: match[0], label: parsed.alias ?? target, target };
        }

        return undefined;
      },
      renderer(token: { label: string; target: string }) {
        return `<button class="wikilink" data-target="${escapeHtmlAttribute(token.target)}" type="button">${escapeHtml(token.label)}</button>`;
      }
    }
  ]
};

function registerMarkedExtensions(): void {
  const globalScope = globalThis as { [MARKDOWN_EXTENSIONS_REGISTERED]?: boolean };

  if (globalScope[MARKDOWN_EXTENSIONS_REGISTERED]) {
    return;
  }

  marked.use(mathExtension as Parameters<typeof marked.use>[0]);
  marked.use(obsidianExtension as Parameters<typeof marked.use>[0]);
  marked.use(markedFootnote());
  globalScope[MARKDOWN_EXTENSIONS_REGISTERED] = true;
}

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

export function normalizeEmbedTarget(target: string): string | null {
  const [targetWithoutHeading = ""] = target.trim().split("#", 1);
  const [targetWithoutBlock = ""] = targetWithoutHeading.split("^", 1);
  const normalized = targetWithoutBlock.replace(/\\/g, "/");

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

  return ensureMarkdownExtension(normalized);
}

export function resolveWorkspaceImagePath(href: string | null | undefined): string | null {
  const trimmedHref = href?.trim() ?? "";
  if (trimmedHref === "") return null;

  const normalizedHref = trimmedHref.replace(/\\/g, "/");

  if (
    normalizedHref.startsWith("/") ||
    normalizedHref.startsWith("//") ||
    normalizedHref.includes("\0") ||
    normalizedHref.includes("?") ||
    normalizedHref.includes("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalizedHref)
  ) {
    return null;
  }

  const segments = normalizedHref.split("/").filter((segment) => segment !== "" && segment !== ".");

  if (segments.length === 0 || segments.some((segment) => segment === "..")) {
    return null;
  }

  const fileName = segments.at(-1) ?? "";
  const extension = fileName.match(/\.[^.]+$/)?.[0].toLowerCase();

  if (!extension || !supportedPreviewImageExtensions.has(extension)) {
    return null;
  }

  return segments.join("/");
}

function renderImagePlaceholder(
  href: string | null | undefined,
  title: string | null | undefined,
  text: string | null | undefined,
  imagePath?: string
): string {
  const alt = escapeHtml(text ?? "");
  const titleAttribute = title ? ` title="${escapeHtmlAttribute(title)}"` : "";
  const pathAttributes = imagePath
    ? ` data-relic-image-alt="${escapeHtmlAttribute(text ?? "")}" data-relic-image-class="preview-image" data-relic-image-path="${escapeHtmlAttribute(imagePath)}"`
    : "";

  return `<span class="preview-image-placeholder"${pathAttributes}${titleAttribute}>${alt || escapeHtml(href ?? "")}</span>`;
}

function buildRenderer(canLoadWorkspaceImages: boolean): Renderer {
  const renderer = new marked.Renderer();

  renderer.code = ({ lang, text }) => {
    const diagramLanguage = diagramLanguageFor(lang);
    if (diagramLanguage) {
      const escaped = escapeHtml(text);
      const sourceAttribute = escapeHtmlAttribute(encodeDiagramSourceAttribute(text));

      return `<div class="preview-diagram preview-diagram--${diagramLanguage}" data-diagram-language="${diagramLanguage}" data-diagram-source="${sourceAttribute}"><pre><code class="language-${diagramLanguage}">${escaped}</code></pre></div>`;
    }

    const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
    const highlighted = renderHighlightedCode(language, text);

    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
  };

  renderer.heading = ({ depth, text }: { depth: number; text: string }) => {
    const plainText = text.replace(/<[^>]+>/g, "");
    const id = slugifyHeading(plainText);

    return `<h${depth} id="${escapeHtml(id)}">${text}</h${depth}>\n`;
  };

  renderer.image = ({ href, title, text }) => {
    const imagePath = canLoadWorkspaceImages ? resolveWorkspaceImagePath(href) : null;
    return renderImagePlaceholder(href, title, text, imagePath ?? undefined);
  };

  renderer.link = ({ href, title, text }) => {
    if (!isSafePreviewUrl(href)) return text;

    const titleAttribute = title ? ` title="${escapeHtmlAttribute(title)}"` : "";
    return `<a href="${escapeHtmlAttribute(href)}"${titleAttribute}>${text}</a>`;
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

  for (const link of scanWikiLinks(content)) {
    if (link.kind !== "embed") continue;
    const target = normalizeEmbedTarget(formatWikiLinkTargetReference(link));

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
  const cacheKey = createPreviewCacheKey(content, workspacePath, embeds, renderEmbeds, t);
  const cached = previewRenderCache.get(cacheKey);

  if (cached) return cached;

  registerMarkedExtensions();
  const renderer = buildRenderer(Boolean(workspacePath?.trim()));
  const withEmbedPlaceholders = renderEmbeds
    ? content.replace(/!\[\[([^\]\n]+)\]\]/g, (match, rawTarget: string) => {
        const target = normalizeEmbedTarget(rawTarget);

        if (!target) {
          return `\n\n<div class="preview-file-embed preview-file-embed--error">${escapeHtml(match)}</div>\n\n`;
        }

        return `\n\n${renderFileEmbed(target, embeds, workspacePath, t)}\n\n`;
      })
    : replaceEmbedWikiLinksWithRegularLinks(content);
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

  rememberCacheEntry(previewRenderCache, cacheKey, sanitized, maxPreviewCacheEntries);
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

function replaceEmbedWikiLinksWithRegularLinks(content: string): string {
  let result = content;
  let offset = 0;

  for (const link of scanWikiLinks(content)) {
    if (link.kind !== "embed") continue;
    const nextRaw = link.raw.slice(1);
    const from = link.from + offset;
    result = result.slice(0, from) + nextRaw + result.slice(from + link.raw.length);
    offset += nextRaw.length - link.raw.length;
  }

  return result;
}

function renderHighlightedCode(language: string, text: string): string {
  const cacheKey = `${language}\n${text}`;
  const cached = highlightCache.get(cacheKey);

  if (cached) return cached;

  const highlighted = hljs.highlight(text, { language }).value;
  rememberCacheEntry(highlightCache, cacheKey, highlighted, maxHighlightCacheEntries);
  return highlighted;
}

function createPreviewCacheKey(
  content: string,
  workspacePath: string | null | undefined,
  embeds: Map<string, EmbedState>,
  renderEmbeds: boolean,
  t: Translator
): string {
  return JSON.stringify({
    content,
    embeds: Array.from(embeds.entries()).toSorted(([a], [b]) => a.localeCompare(b, "ja")),
    renderEmbeds,
    translatorKey: t("preview.embedLoading", { target: "__relic_cache_key__" }),
    workspacePath: workspacePath ?? null
  });
}

function rememberCacheEntry(cache: Map<string, string>, key: string, value: string, maxEntries: number): void {
  cache.set(key, value);

  if (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}
