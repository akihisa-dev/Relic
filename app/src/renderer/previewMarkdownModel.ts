import { ensureMarkdownExtension } from "../shared/markdownExtension";
import { formatWikiLinkTargetReference, scanWikiLinks } from "../shared/links";

export const maxEmbeddedFileLength = 20_000;

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

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeHtmlAttribute(value: string): string {
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
  ) return null;
  const extension = normalized.match(/\.[^.?#/]+(?=$|[?#])/)?.[0].toLowerCase();
  return extension && extension !== ".md" ? null : ensureMarkdownExtension(normalized);
}

export function resolveWorkspaceImagePath(href: string | null | undefined): string | null {
  const normalizedHref = (href?.trim() ?? "").replace(/\\/g, "/");
  if (
    normalizedHref === "" ||
    normalizedHref.startsWith("/") ||
    normalizedHref.startsWith("//") ||
    normalizedHref.includes("\0") ||
    normalizedHref.includes("?") ||
    normalizedHref.includes("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalizedHref)
  ) return null;
  const segments = normalizedHref.split("/").filter((segment) => segment !== "" && segment !== ".");
  if (segments.length === 0 || segments.some((segment) => segment === "..")) return null;
  const extension = (segments.at(-1) ?? "").match(/\.[^.]+$/)?.[0].toLowerCase();
  return extension && supportedPreviewImageExtensions.has(extension) ? segments.join("/") : null;
}

export function toggleNthCheckbox(source: string, index: number): string {
  let count = -1;
  return source.replace(/^([ \t]*[-*+] \[)([ xX])(\])/gm, (match, before, state, after) => {
    count += 1;
    return count === index ? `${before}${state === " " ? "x" : " "}${after}` : match;
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
