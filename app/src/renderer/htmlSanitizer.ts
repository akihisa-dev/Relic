import DOMPurify from "dompurify";

const allowedPreviewUriPattern = /^(?:(?:https?|mailto):|#|\/|\.{0,2}\/|(?![a-z][a-z0-9+.-]*:)[^\s]*)/i;

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

export function sanitizePreviewHtml(html: string): string {
  return DOMPurify.sanitize(stripUnsafeMarkdownLinkText(html), {
    ADD_ATTR: [
      "checked",
      "class",
      "data-diagram-language",
      "data-diagram-source",
      "data-target",
      "id"
    ],
    ALLOWED_URI_REGEXP: allowedPreviewUriPattern,
    FORBID_ATTR: forbiddenEventAttributes,
    FORBID_TAGS: ["base", "embed", "form", "iframe", "img", "object", "script"]
  });
}

export function sanitizeSvgHtml(svg: string): string {
  return DOMPurify.sanitize(svg, {
    ALLOWED_URI_REGEXP: allowedPreviewUriPattern,
    FORBID_ATTR: forbiddenEventAttributes,
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
