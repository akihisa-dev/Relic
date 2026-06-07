import { diagramLabel, type DiagramLanguage } from "./diagramLanguage";

export const diagramMaxSourceChars = 50_000;
export const diagramRenderTimeoutMs = 5_000;

export function assertDiagramSourceWithinLimit(language: DiagramLanguage, source: string): void {
  if (source.length <= diagramMaxSourceChars) return;

  throw new Error(`${diagramLabel(language)} diagram source is too large to render.`);
}

export function withDiagramRenderTimeout<T>(
  operation: Promise<T>,
  language: DiagramLanguage,
  timeoutMs: number = diagramRenderTimeoutMs
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${diagramLabel(language)} diagram rendering timed out.`));
    }, timeoutMs);
  });

  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId !== null) clearTimeout(timeoutId);
  });
}
