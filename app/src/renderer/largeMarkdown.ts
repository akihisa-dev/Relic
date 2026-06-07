export const largeMarkdownMaxContentBytes = 1024 * 1024;
export const largeMarkdownMaxLineLength = 80000;

export type LargeMarkdownFallbackReason = "content-size" | "line-length";

export function isLargeMarkdownContent(content: string): boolean {
  return largeMarkdownFallbackReason(content) !== null;
}

function largeMarkdownFallbackReason(content: string): LargeMarkdownFallbackReason | null {
  if (new Blob([content]).size > largeMarkdownMaxContentBytes) return "content-size";

  let currentLineLength = 0;

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === "\n") {
      currentLineLength = 0;
      continue;
    }

    currentLineLength += 1;
    if (currentLineLength > largeMarkdownMaxLineLength) return "line-length";
  }

  return null;
}
