const largeMarkdownMaxContentBytes = 1024 * 1024;
const largeMarkdownMaxLineLength = 80000;

export function isLargeMarkdownContent(content: string): boolean {
  if (new Blob([content]).size > largeMarkdownMaxContentBytes) return true;

  return content.split("\n").some((line) => line.length > largeMarkdownMaxLineLength);
}
