export function formatGeneratedMarkdownHeadingText(value: string, fallback = "無題"): string {
  const normalized = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^#+\s*/, "")
    .replace(/^[-*_]{3,}$/, "");

  return normalized || fallback;
}
