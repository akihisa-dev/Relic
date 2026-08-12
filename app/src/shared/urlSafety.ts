/**
 * Reject ASCII control characters before a URL or path is trimmed or parsed.
 *
 * URL parsers and HTML consumers may normalize controls differently, so a
 * value containing one is never treated as a navigation or workspace target.
 */
export function normalizeUrlForSecurity(value: string): string | null {
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value.trim();
}
