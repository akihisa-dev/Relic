export function redactSensitiveText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, "sk-[redacted]")
    .replace(/OPENAI_API_KEY\s*=\s*[^\s"']+/gi, "OPENAI_API_KEY=[redacted]")
    .replace(/(^|[^A-Za-z0-9_])api[_-]?key["']?\s*[:=]\s*["']?[^"',\s}]+/gi, "$1apiKey=[redacted]");
}
