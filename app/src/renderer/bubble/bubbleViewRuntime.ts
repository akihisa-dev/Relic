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

export function requestBubbleFrame(callback: FrameRequestCallback): number {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }

  return window.setTimeout(() => callback(performance.now()), 16);
}

export function requestBubbleFrameOnce(
  frameRef: { current: number | null },
  callback: FrameRequestCallback
): void {
  if (frameRef.current !== null) return;

  frameRef.current = requestBubbleFrame((timestamp) => {
    frameRef.current = null;
    callback(timestamp);
  });
}

export function cancelBubbleFrame(id: number): void {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(id);
    return;
  }

  window.clearTimeout(id);
}
