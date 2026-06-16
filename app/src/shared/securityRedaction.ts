export function redactSensitiveText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, "sk-[redacted]")
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{16,}/g, "[token redacted]")
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}/g, "[token redacted]")
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, "[token redacted]")
    .replace(/[A-Z0-9_]*API_KEY\s*=\s*[^\s"']+/gi, (match) => `${match.split("=")[0].trim()}=[redacted]`)
    .replace(/(^|[^A-Za-z0-9_])api[_-]?key["']?\s*[:=]\s*["']?[^"',\s}]+/gi, "$1apiKey=[redacted]")
    .replace(/(^|[\s"'(=])\/(?:Users|home|private|tmp|var|Volumes)\/[^\s"')\]}]+/g, "$1[path redacted]")
    .replace(/(^|[\s"'(=])[A-Za-z]:\\[^\s"')\]}]+/g, "$1[path redacted]");
}
