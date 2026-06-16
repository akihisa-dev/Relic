const markdownExtensionPattern = /\.md$/i;

export function hasMarkdownExtension(value: string): boolean {
  return markdownExtensionPattern.test(value);
}

export function ensureMarkdownExtension(value: string): string {
  return hasMarkdownExtension(value) ? value : `${value}.md`;
}

export function stripMarkdownExtension(value: string): string {
  return value.replace(markdownExtensionPattern, "");
}
