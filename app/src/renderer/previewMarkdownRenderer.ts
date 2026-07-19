import hljs from "highlight.js";
import katex from "katex";
import { marked, type Renderer } from "marked";
import markedFootnote from "marked-footnote";

import { parseWikiLinkBody, formatWikiLinkTargetReference } from "../shared/links";
import { diagramLanguageFor } from "./diagramLanguage";
import { encodeDiagramSourceAttribute } from "./diagramSourceAttribute";
import { isSafePreviewUrl } from "./htmlSanitizer";
import { rememberPreviewCacheEntry } from "./previewMarkdownCache";
import {
  escapeHtml,
  escapeHtmlAttribute,
  resolveWorkspaceImagePath,
  slugifyHeading
} from "./previewMarkdownModel";

const MARKDOWN_EXTENSIONS_REGISTERED = Symbol.for("relic.previewMarkdown.extensionsRegistered");
const maxHighlightCacheEntries = 80;
const maxMathCacheEntries = 80;
const highlightCache = new Map<string, string>();
const mathCache = new Map<string, string>();

export function registerPreviewMarkdownExtensions(): void {
  const globalScope = globalThis as { [MARKDOWN_EXTENSIONS_REGISTERED]?: boolean };
  if (globalScope[MARKDOWN_EXTENSIONS_REGISTERED]) return;
  marked.use(mathExtension as Parameters<typeof marked.use>[0]);
  marked.use(obsidianExtension as Parameters<typeof marked.use>[0]);
  marked.use(markedFootnote());
  globalScope[MARKDOWN_EXTENSIONS_REGISTERED] = true;
}

export function createPreviewMarkdownRenderer(canLoadWorkspaceImages: boolean): Renderer {
  const renderer = new marked.Renderer();
  renderer.code = ({ lang, text }) => {
    const diagramLanguage = diagramLanguageFor(lang);
    if (diagramLanguage) {
      const sourceAttribute = escapeHtmlAttribute(encodeDiagramSourceAttribute(text));
      return `<div class="preview-diagram preview-diagram--${diagramLanguage}" data-diagram-language="${diagramLanguage}" data-diagram-source="${sourceAttribute}"><pre><code class="language-${diagramLanguage}">${escapeHtml(text)}</code></pre></div>`;
    }
    const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
    return `<pre><code class="hljs language-${language}">${renderHighlightedCode(language, text)}</code></pre>`;
  };
  renderer.heading = ({ depth, text }: { depth: number; text: string }) => {
    const id = slugifyHeading(text.replace(/<[^>]+>/g, ""));
    return `<h${depth} id="${escapeHtml(id)}">${text}</h${depth}>\n`;
  };
  renderer.image = ({ href, title, text }) => {
    const imagePath = canLoadWorkspaceImages ? resolveWorkspaceImagePath(href) : null;
    const alt = escapeHtml(text ?? "");
    const titleAttribute = title ? ` title="${escapeHtmlAttribute(title)}"` : "";
    const pathAttributes = imagePath
      ? ` data-relic-image-alt="${escapeHtmlAttribute(text ?? "")}" data-relic-image-class="preview-image" data-relic-image-path="${escapeHtmlAttribute(imagePath)}"`
      : "";
    return `<span class="preview-image-placeholder"${pathAttributes}${titleAttribute}>${alt || escapeHtml(href ?? "")}</span>`;
  };
  renderer.link = ({ href, title, text }) => {
    if (!isSafePreviewUrl(href)) return text;
    const titleAttribute = title ? ` title="${escapeHtmlAttribute(title)}"` : "";
    return `<a href="${escapeHtmlAttribute(href)}"${titleAttribute}>${text}</a>`;
  };
  return renderer;
}

function renderMath(tex: string, displayMode: boolean): string {
  const cacheKey = `${displayMode ? "block" : "inline"}\n${tex}`;
  const cached = mathCache.get(cacheKey);
  if (cached) return cached;
  try {
    const rendered = katex.renderToString(tex, { displayMode, throwOnError: false });
    rememberPreviewCacheEntry(mathCache, cacheKey, rendered, maxMathCacheEntries);
    return rendered;
  } catch {
    return `<span class="math-error">${tex}</span>`;
  }
}

const mathExtension = {
  extensions: [
    {
      name: "mathBlock",
      level: "block" as const,
      start: (src: string) => src.indexOf("$$"),
      tokenizer(src: string) {
        const match = /^\$\$([^$]+)\$\$/.exec(src);
        return match ? { type: "mathBlock", raw: match[0], text: (match[1] ?? "").trim() } : undefined;
      },
      renderer: (token: { text: string }) => `<div class="math-block">${renderMath(token.text, true)}</div>`
    },
    {
      name: "mathInline",
      level: "inline" as const,
      start: (src: string) => src.indexOf("$"),
      tokenizer(src: string) {
        const match = /^\$([^$\n]+)\$/.exec(src);
        return match ? { type: "mathInline", raw: match[0], text: (match[1] ?? "").trim() } : undefined;
      },
      renderer: (token: { text: string }) => `<span class="math-inline">${renderMath(token.text, false)}</span>`
    }
  ]
};

const obsidianExtension = {
  extensions: [
    {
      name: "unsafeLink",
      level: "inline" as const,
      start: (src: string) => src.indexOf("["),
      tokenizer(src: string) {
        const match = /^\[([^\]\n]+)\]\(((?:javascript|file):[^\n]*)\)/i.exec(src);
        return match ? { type: "unsafeLink", raw: match[0], text: match[1] ?? "" } : undefined;
      },
      renderer: (token: { text: string }) => escapeHtml(token.text)
    },
    {
      name: "highlight",
      level: "inline" as const,
      start: (src: string) => src.indexOf("=="),
      tokenizer(src: string) {
        const match = /^==([^=]+)==/.exec(src);
        return match ? { type: "highlight", raw: match[0], text: match[1] ?? "" } : undefined;
      },
      renderer: (token: { text: string }) => `<mark>${escapeHtml(token.text)}</mark>`
    },
    {
      name: "wikilink",
      level: "inline" as const,
      start: (src: string) => src.indexOf("[["),
      tokenizer(src: string) {
        const match = /^\[\[([^\]]+)\]\]/.exec(src);
        if (!match) return undefined;
        const parsed = parseWikiLinkBody(match[1] ?? "");
        if (!parsed) return undefined;
        const target = formatWikiLinkTargetReference(parsed);
        return { type: "wikilink", raw: match[0], label: parsed.alias ?? target, target };
      },
      renderer: (token: { label: string; target: string }) => (
        `<button class="wikilink" data-target="${escapeHtmlAttribute(token.target)}" type="button">${escapeHtml(token.label)}</button>`
      )
    }
  ]
};

function renderHighlightedCode(language: string, text: string): string {
  const cacheKey = `${language}\n${text}`;
  const cached = highlightCache.get(cacheKey);
  if (cached) return cached;
  const highlighted = hljs.highlight(text, { language }).value;
  rememberPreviewCacheEntry(highlightCache, cacheKey, highlighted, maxHighlightCacheEntries);
  return highlighted;
}
