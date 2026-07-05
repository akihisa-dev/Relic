import type { ReactElement } from "react";

import type { WorkspaceChart } from "../../shared/ipc";
import { ChronicleBubbleCanvas } from "./ChronicleBubbleCanvas";

interface ChartViewProps {
  chart?: WorkspaceChart | null;
  charts?: WorkspaceChart[];
  onOpenFile: (path: string) => void;
}

const defaultCharts: WorkspaceChart[] = [];

export function ChartView({ chart = null, charts = defaultCharts, onOpenFile }: ChartViewProps): ReactElement {
  const activeChart = chart ?? charts.find((candidate) => candidate.source === "chronicle") ?? null;
  const entries = activeChart?.entries ?? [];

  return (
    <div className="chronicle-panel">
      <ChronicleBubbleCanvas
        entries={entries}
        onOpenFile={onOpenFile}
      />
    </div>
  );
}
