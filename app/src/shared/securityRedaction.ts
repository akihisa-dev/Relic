export function redactSensitiveText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/Basic\s+[A-Za-z0-9+/=-]+/gi, "Basic [redacted]")
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, "sk-[redacted]")
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{16,}/g, "[token redacted]")
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}/g, "[token redacted]")
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, "[token redacted]")
    .replace(/(_authToken\s*=\s*)[^\s"']+/gi, "$1[redacted]")
    .replace(/\b(?:npm_[A-Za-z0-9]{16,}|NPM_TOKEN\s*=\s*[^\s"']+)/g, (match) => {
      const separator = match.indexOf("=");
      return separator >= 0 ? `${match.slice(0, separator).trim()}=[redacted]` : "[token redacted]";
    })
    .replace(/\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^\s"']+/gi, "[connection redacted]")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "[private key redacted]")
    .replace(/[A-Z0-9_]*API_KEY\s*=\s*[^\s"']+/gi, (match) => `${match.split("=")[0].trim()}=[redacted]`)
    .replace(/(^|[^A-Za-z0-9_])api[_-]?key["']?\s*[:=]\s*["']?[^"',\s}]+/gi, "$1apiKey=[redacted]")
    .replace(/(^|[\s"'(=])\/(?!\/)(?:[^\n"')\]}]+\/)+[^\n"')\]}]+/g, "$1[path redacted]")
    .replace(/(^|[\s"'(=])[A-Za-z]:[\\/][^\n"')\]}]+/g, "$1[path redacted]")
    .replace(/(^|[\s"'(=])\\\\[^\\\n"')\]}]+\\[^\n"')\]}]+/g, "$1[path redacted]");
}
