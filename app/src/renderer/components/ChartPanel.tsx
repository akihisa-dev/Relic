import type { ReactElement } from "react";

import type { WorkspaceChart } from "../../shared/ipc";
import { useT } from "../i18n";
import { ChronicleCanvas } from "./ChronicleCanvas";

interface ChartViewProps {
  chart?: WorkspaceChart | null;
  charts?: WorkspaceChart[];
  onOpenFile: (path: string) => void;
}

const defaultCharts: WorkspaceChart[] = [];

export function ChartView({ chart = null, charts = defaultCharts, onOpenFile }: ChartViewProps): ReactElement {
  const t = useT();
  const activeChart = chart ?? charts[0] ?? null;

  if (!activeChart || activeChart.entries.length === 0) {
    return <div className="frontmatter-field-empty chronicle-canvas-empty">{t("chronicle.empty")}</div>;
  }

  return (
    <div className="chronicle-panel">
      <ChronicleCanvas entries={activeChart.entries} onOpenFile={onOpenFile} />
    </div>
  );
}
