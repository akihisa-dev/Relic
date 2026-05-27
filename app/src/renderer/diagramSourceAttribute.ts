const diagramSourceAttributePrefix = "uri:";

export function encodeDiagramSourceAttribute(source: string): string {
  return `${diagramSourceAttributePrefix}${encodeURIComponent(source)}`;
}

export function decodeDiagramSourceAttribute(value: string): string {
  if (!value.startsWith(diagramSourceAttributePrefix)) return "";

  try {
    return decodeURIComponent(value.slice(diagramSourceAttributePrefix.length));
  } catch {
    return "";
  }
}
