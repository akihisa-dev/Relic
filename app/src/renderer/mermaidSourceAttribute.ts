const mermaidSourceAttributePrefix = "uri:";

export function encodeMermaidSourceAttribute(source: string): string {
  return `${mermaidSourceAttributePrefix}${encodeURIComponent(source)}`;
}

export function decodeMermaidSourceAttribute(value: string): string {
  if (!value.startsWith(mermaidSourceAttributePrefix)) return value;

  try {
    return decodeURIComponent(value.slice(mermaidSourceAttributePrefix.length));
  } catch {
    return value;
  }
}
