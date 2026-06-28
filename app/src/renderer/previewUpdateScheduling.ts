export const largePreviewContentChars = 20_000;
export const hugePreviewContentChars = 100_000;
export const largePreviewUpdateDelayMs = 120;
export const hugePreviewUpdateDelayMs = 240;

export function previewUpdateDelayMs(content: string): number {
  if (content.length >= hugePreviewContentChars) {
    return hugePreviewUpdateDelayMs;
  }

  if (content.length >= largePreviewContentChars) {
    return largePreviewUpdateDelayMs;
  }

  return 0;
}
