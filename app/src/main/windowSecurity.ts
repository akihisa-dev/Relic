export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    return parsed.protocol === "https:" && (
      parsed.hostname === "github.com" ||
      parsed.hostname.endsWith(".github.com")
    );
  } catch {
    return false;
  }
}

export function isAllowedPackagedAppNavigation(url: string, rendererIndexUrl: string): boolean {
  return url === rendererIndexUrl || url.startsWith(`${rendererIndexUrl}#`);
}
