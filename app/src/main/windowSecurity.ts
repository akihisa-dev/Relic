export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    return parsed.protocol === "https:" && (
      parsed.hostname === "github.com" ||
      parsed.hostname.endsWith(".github.com") ||
      parsed.hostname === "platform.openai.com"
    );
  } catch {
    return false;
  }
}
