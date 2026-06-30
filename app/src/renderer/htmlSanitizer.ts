import DOMPurify from "dompurify";

// Markdown preview keeps normal http links as text navigation targets, but window-level opening is separately restricted to an https allowlist.
const allowedPreviewUriPattern = /^(?!\/\/)(?:(?:https?|mailto):|#|\/|\.{0,2}\/|(?![a-z][a-z0-9+.-]*:)[^\s]*)/i;
const allowedPreviewImageUriPattern = /^file:\/\/\//i;
const allowedSanitizedPreviewUriPattern = /^(?:file:\/\/\/|(?!\/\/)(?:(?:https?|mailto):|#|\/|\.{0,2}\/|(?![a-z][a-z0-9+.-]*:)[^\s]*))/i;

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
  return DOMPurify.sanitize(stripUnsafePreviewLinks(stripUnsafePreviewImages(stripUnsafeMarkdownLinkText(html), allowedImageSrcs)), {
    ADD_ATTR: [
      "alt",
      "checked",
      "class",
      "data-diagram-language",
      "data-diagram-source",
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

export function sanitizeSvgHtml(svg: string): string {
  return DOMPurify.sanitize(svg, {
    ALLOWED_URI_REGEXP: allowedPreviewUriPattern,
    FORBID_ATTR: forbiddenPreviewAttributes,
    FORBID_TAGS: ["foreignObject", "script"],
    USE_PROFILES: { svg: true, svgFilters: true }
  });
}

export function isSafePreviewUrl(value: string): boolean {
  return allowedPreviewUriPattern.test(value.trim());
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

    if (!image.classList.contains("preview-image") || !allowedPreviewImageUriPattern.test(src) || !allowedImageSrcs.has(src)) {
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

    if (/^(?:file|javascript):/i.test(href.trim())) {
      link.replaceWith(...Array.from(link.childNodes));
    }
  }

  return template.innerHTML;
}
