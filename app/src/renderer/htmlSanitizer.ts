import DOMPurify from "dompurify";

import { normalizeUrlForSecurity } from "../shared/urlSafety";

// Markdown preview keeps normal http links as text navigation targets, but window-level opening is separately restricted to an https allowlist.
const allowedPreviewUriPattern = /^(?![\s\S]*[\u0000-\u001f\u007f])(?!\/\/)(?:(?:https?|mailto):|#|\/|\.{0,2}\/|(?![a-z][a-z0-9+.-]*:)[^\s]*)/i;
const allowedPreviewImageUriPattern = /^(?![\s\S]*[\u0000-\u001f\u007f])data:image\/(?:avif|bmp|gif|jpeg|png|svg\+xml|webp);base64,/i;
const allowedSanitizedPreviewUriPattern = /^(?![\s\S]*[\u0000-\u001f\u007f])(?:data:image\/(?:avif|bmp|gif|jpeg|png|svg\+xml|webp);base64,|(?!\/\/)(?:(?:https?|mailto):|#|\/|\.{0,2}\/|(?![a-z][a-z0-9+.-]*:)[^\s]*))/i;

const forbiddenEventAttributes = [
  "onabort",
  "onauxclick",
  "onbeforeinput",
  "onblur",
  "onclick",
  "onerror",
  "onfocus",
  "oninput",
  "onkeydown",
  "onkeypress",
  "onkeyup",
  "onload",
  "onmousedown",
  "onmouseenter",
  "onmouseleave",
  "onmousemove",
  "onmouseout",
  "onmouseover",
  "onmouseup",
  "onsubmit"
];

const forbiddenPreviewAttributes = [
  ...forbiddenEventAttributes,
  "style"
];

export function sanitizePreviewHtml(html: string, allowedImageSrcs: ReadonlySet<string> = new Set()): string {
  return DOMPurify.sanitize(stripUnsafePreviewDataUris(
    stripUnsafePreviewLinks(stripUnsafePreviewImages(stripUnsafeMarkdownLinkText(html), allowedImageSrcs)),
    allowedImageSrcs
  ), {
    ADD_ATTR: [
      "alt",
      "checked",
      "class",
      "data-diagram-language",
      "data-diagram-source",
      "data-relic-image-alt",
      "data-relic-image-class",
      "data-relic-image-path",
      "data-target",
      "id",
      "src",
      "title"
    ],
    ALLOWED_URI_REGEXP: allowedSanitizedPreviewUriPattern,
    FORBID_ATTR: forbiddenPreviewAttributes,
    FORBID_TAGS: ["base", "embed", "form", "iframe", "meta", "object", "script", "webview"]
  });
}

export function sanitizeTrustedMathHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: [
      "aria-hidden",
      "class",
      "height",
      "style",
      "viewBox",
      "width",
      "xmlns"
    ],
    ALLOWED_URI_REGEXP: allowedSanitizedPreviewUriPattern,
    FORBID_ATTR: forbiddenEventAttributes,
    FORBID_TAGS: ["base", "embed", "form", "iframe", "meta", "object", "script", "webview"]
  });
}

export function sanitizeSvgHtml(svg: string): string {
  return DOMPurify.sanitize(svg, {
    ALLOWED_URI_REGEXP: allowedPreviewUriPattern,
    FORBID_ATTR: forbiddenPreviewAttributes,
    FORBID_TAGS: ["foreignObject", "script"],
    USE_PROFILES: { svg: true, svgFilters: true }
  });
}

export function isSafePreviewUrl(value: string): boolean {
  const normalizedValue = normalizeUrlForSecurity(value);
  return normalizedValue !== null && allowedPreviewUriPattern.test(normalizedValue);
}

function stripUnsafeMarkdownLinkText(html: string): string {
  if (typeof document === "undefined") return html;

  const template = document.createElement("template");
  template.innerHTML = html;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const replacements: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!(node instanceof Text)) continue;
    if (node.parentElement?.closest("code,pre")) continue;
    if (/\[[^\]\n]+\]\((?:javascript|file):[^\n]*\)/i.test(node.data)) {
      replacements.push(node);
    }
  }

  replacements.forEach((node) => {
    node.data = node.data.replace(/\[([^\]\n]+)\]\((?:javascript|file):[^\n]*\)/gi, "$1");
  });

  return template.innerHTML;
}

function stripUnsafePreviewImages(html: string, allowedImageSrcs: ReadonlySet<string>): string {
  if (typeof document === "undefined") return html;

  const template = document.createElement("template");
  template.innerHTML = html;

  for (const image of Array.from(template.content.querySelectorAll("img"))) {
    const src = image.getAttribute("src") ?? "";

    if (!image.classList.contains("preview-image") || normalizeUrlForSecurity(src) === null || !allowedPreviewImageUriPattern.test(src) || !allowedImageSrcs.has(src)) {
      image.replaceWith(document.createTextNode(image.getAttribute("alt") ?? ""));
    }
  }

  return template.innerHTML;
}

function stripUnsafePreviewLinks(html: string): string {
  if (typeof document === "undefined") return html;

  const template = document.createElement("template");
  template.innerHTML = html;

  for (const link of Array.from(template.content.querySelectorAll("a"))) {
    const href = link.getAttribute("href") ?? "";
    const normalizedHref = normalizeUrlForSecurity(href);

    if (normalizedHref === null || /^(?:data|file|javascript):/i.test(normalizedHref)) {
      link.replaceWith(...Array.from(link.childNodes));
    }
  }

  return template.innerHTML;
}

function stripUnsafePreviewDataUris(html: string, allowedImageSrcs: ReadonlySet<string>): string {
  if (typeof document === "undefined") return html;

  const template = document.createElement("template");
  template.innerHTML = html;

  for (const element of Array.from(template.content.querySelectorAll<HTMLElement>("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      if (!/^(?:href|src|xlink:href)$/i.test(attribute.name) || !/^data:/i.test(attribute.value.trim())) continue;
      if (normalizeUrlForSecurity(attribute.value) === null) {
        element.removeAttribute(attribute.name);
        continue;
      }
      const isAllowedPreviewImage = element instanceof HTMLImageElement &&
        element.classList.contains("preview-image") &&
        allowedImageSrcs.has(attribute.value);
      if (!isAllowedPreviewImage) element.removeAttribute(attribute.name);
    }
  }

  return template.innerHTML;
}
