export function cancelChronicleCanvasFrame(frameRef: { current: number | null }): void {
  if (frameRef.current === null) return;
  cancelAnimationFrame(frameRef.current);
  frameRef.current = null;
}

export function chronicleCanvasWheelFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.006);
}
