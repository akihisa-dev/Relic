export function mermaidSafeId(raw: string, fallback: string, used: Set<string>): string {
  const normalized = raw.trim().replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  const base = normalized.length > 0 ? normalized : fallback;
  const prefixed = /^[A-Za-z]/.test(base) ? base : `node_${base}`;
  let candidate = prefixed;
  let index = 2;

  while (used.has(candidate)) {
    candidate = `${prefixed}_${index}`;
    index += 1;
  }

  used.add(candidate);
  return candidate;
}

export function mermaidText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\r?\n/g, "<br/>")
    .trim();
}

export function mermaidQuoted(value: string): string {
  return `"${mermaidText(value)}"`;
}

export function markdownFileDisplayName(filePath: string): string {
  const fileName = filePath.split("/").at(-1) ?? filePath;
  return fileName.endsWith(".md") ? fileName.slice(0, -3) : fileName;
}
