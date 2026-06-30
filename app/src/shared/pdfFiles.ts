export function isSupportedPdfPath(filePath: string): boolean {
  return /\.pdf$/i.test(filePath);
}
