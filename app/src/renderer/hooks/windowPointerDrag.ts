import type { PointerEvent as ReactPointerEvent } from "react";

interface StartWindowPointerDragInput<T extends Element> {
  event: ReactPointerEvent<T>;
  onCancel?: (event: globalThis.PointerEvent) => void;
  onMove: (event: globalThis.PointerEvent) => void;
  onUp?: (event: globalThis.PointerEvent) => void;
  pointerCaptureTarget?: Element | null;
}

export function startWindowPointerDrag<T extends Element>({
  event,
  onCancel,
  onMove,
  onUp,
  pointerCaptureTarget = event.currentTarget
}: StartWindowPointerDragInput<T>): void {
  const pointerId = event.pointerId;
  let active = true;

  event.preventDefault();

  if (pointerCaptureTarget?.setPointerCapture) {
    pointerCaptureTarget.setPointerCapture(pointerId);
  }

  const cleanup = (): void => {
    if (!active) return;
    active = false;

    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", handleUp);
    window.removeEventListener("pointercancel", handleCancel);

    if (pointerCaptureTarget?.hasPointerCapture?.(pointerId)) {
      pointerCaptureTarget.releasePointerCapture(pointerId);
    }
  };

  const handleUp = (upEvent: globalThis.PointerEvent): void => {
    cleanup();
    onUp?.(upEvent);
  };

  const handleCancel = (cancelEvent: globalThis.PointerEvent): void => {
    cleanup();
    onCancel?.(cancelEvent);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", handleUp);
  window.addEventListener("pointercancel", handleCancel);
}
