export type DiagramLanguage = "d2" | "mermaid";

export function diagramLanguageFor(lang: string | undefined | null): DiagramLanguage | null {
  const token = lang?.trim().split(/\s+/, 1)[0]?.toLowerCase();

  if (token === "mermaid") return "mermaid";
  if (token === "d2") return "d2";
  return null;
}

export function diagramLabel(language: DiagramLanguage): string {
  return language === "d2" ? "D2" : "Mermaid";
}
