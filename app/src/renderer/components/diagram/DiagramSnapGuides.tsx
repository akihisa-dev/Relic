import { type ReactElement } from "react";

import { type DiagramSnapGuide } from "./diagramSnap";

interface DiagramSnapGuidesProps {
  guides: DiagramSnapGuide[];
  height: number;
  width: number;
}

export function DiagramSnapGuides({ guides, height, width }: DiagramSnapGuidesProps): ReactElement | null {
  if (guides.length === 0) return null;

  return (
    <svg
      aria-hidden="true"
      className="diagram-canvas-snap-guides"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      {guides.map((guide) => (
        <line
          key={`${guide.axis}-${guide.value}`}
          x1={guide.axis === "x" ? guide.value : 0}
          x2={guide.axis === "x" ? guide.value : width}
          y1={guide.axis === "y" ? guide.value : 0}
          y2={guide.axis === "y" ? guide.value : height}
        />
      ))}
    </svg>
  );
}
