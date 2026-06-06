import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";

type LayoutResizeBoundarySide = "sidebar" | "secondary-sidebar" | "right-panel";

interface LayoutResizeBoundaryProps {
  "aria-label": string;
  isActive: boolean;
  side: LayoutResizeBoundarySide;
  onResizeStart: (event: ReactMouseEvent) => void;
}

export function LayoutResizeBoundary({
  "aria-label": ariaLabel,
  isActive,
  side,
  onResizeStart
}: LayoutResizeBoundaryProps): ReactElement {
  return (
    <button
      aria-label={ariaLabel}
      className={`layout-resize-boundary layout-resize-boundary--${side}${isActive ? " layout-resize-boundary--active" : ""}`}
      onMouseDown={onResizeStart}
      type="button"
    />
  );
}
