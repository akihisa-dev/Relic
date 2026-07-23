import {
  defaultGraphDrawTheme,
  type GraphDrawTheme
} from "./graphTypes";

export function readGraphDrawTheme(element: Element = document.documentElement): GraphDrawTheme {
  if (typeof window === "undefined") return defaultGraphDrawTheme;

  const styles = getComputedStyle(element);
  const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    accent: token("--color-accent", defaultGraphDrawTheme.accent),
    background: token("--color-bg", defaultGraphDrawTheme.background),
    border: token("--color-border", defaultGraphDrawTheme.border),
    borderStrong: token("--color-border-strong", defaultGraphDrawTheme.borderStrong),
    primary: token("--color-primary", defaultGraphDrawTheme.primary),
    text: token("--color-text", defaultGraphDrawTheme.text),
    textMuted: token("--color-text-muted", defaultGraphDrawTheme.textMuted),
    textSecondary: token("--color-text-secondary", defaultGraphDrawTheme.textSecondary)
  };
}

export function getCanvas2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")) {
    return null;
  }

  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

export function requestGraphFrame(callback: FrameRequestCallback): number {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }

  return window.setTimeout(() => callback(performance.now()), 16);
}

export function requestGraphFrameOnce(
  frameRef: { current: number | null },
  callback: FrameRequestCallback
): void {
  if (frameRef.current !== null) return;

  frameRef.current = requestGraphFrame((timestamp) => {
    frameRef.current = null;
    callback(timestamp);
  });
}

export function cancelGraphFrame(id: number): void {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(id);
    return;
  }

  window.clearTimeout(id);
}
