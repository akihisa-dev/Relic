import { marked } from "marked";

import { scanWikiLinks } from "../shared/links";
import type { Translator } from "./i18nModel";
import { sanitizePreviewHtml } from "./htmlSanitizer";
import { rememberPreviewCacheEntry } from "./previewMarkdownCache";
import {
  escapeHtml,
  normalizeEmbedTarget,
  type EmbedState
} from "./previewMarkdownModel";
import { createPreviewMarkdownRenderer, registerPreviewMarkdownExtensions } from "./previewMarkdownRenderer";

export {
  escapeHtml,
  extractEmbedTargets,
  maxEmbeddedFileLength,
  normalizeEmbedTarget,
  resolveWorkspaceImagePath,
  slugifyHeading,
  toggleNthCheckbox,
  type EmbedState
} from "./previewMarkdownModel";

const maxPreviewCacheEntries = 12;
const previewRenderCache = new Map<string, string>();

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

  registerPreviewMarkdownExtensions();
  const renderer = createPreviewMarkdownRenderer(Boolean(workspacePath?.trim()));
  const withEmbedPlaceholders = renderEmbeds
    ? content.replace(/!\[\[([^\]\n]+)\]\]/g, (match, rawTarget: string) => {
        const target = normalizeEmbedTarget(rawTarget);
        return target
          ? `\n\n${renderFileEmbed(target, embeds, workspacePath, t)}\n\n`
          : `\n\n<div class="preview-file-embed preview-file-embed--error">${escapeHtml(match)}</div>\n\n`;
      })
    : replaceEmbedWikiLinksWithRegularLinks(content);
  const raw = marked.parse(withEmbedPlaceholders, { async: false, renderer }) as string;
  const withCheckboxes = raw.replace(
    /<input disabled="" type="checkbox">/g,
    '<input type="checkbox" class="preview-checkbox">'
  ).replace(
    /<input checked="" disabled="" type="checkbox">/g,
    '<input checked type="checkbox" class="preview-checkbox">'
  );
  const sanitized = sanitizePreviewHtml(withCheckboxes);
  rememberPreviewCacheEntry(previewRenderCache, cacheKey, sanitized, maxPreviewCacheEntries);
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
