import type { ReactElement } from "react";

import type { WorkspaceChart } from "../../shared/ipc";
import { useT } from "../i18n";
import { ChronicleCanvas } from "./ChronicleCanvas";

interface ChartViewProps {
  categoryChoices?: string[];
  chart?: WorkspaceChart | null;
  charts?: WorkspaceChart[];
  hiddenCategoryKeys?: string[];
  onOpenFile: (path: string) => void;
  onHiddenCategoryKeysChange?: (keys: string[]) => void;
  onRailCollapsedChange?: (collapsed: boolean) => void;
  railCollapsed?: boolean;
}

const defaultCharts: WorkspaceChart[] = [];

export function ChartView({
  categoryChoices,
  chart = null,
  charts = defaultCharts,
  hiddenCategoryKeys,
  onHiddenCategoryKeysChange,
  onOpenFile,
  onRailCollapsedChange,
  railCollapsed
}: ChartViewProps): ReactElement {
  const t = useT();
  const activeChart = chart ?? charts[0] ?? null;

  if (!activeChart || activeChart.entries.length === 0) {
    return <div className="frontmatter-field-empty chronicle-canvas-empty">{t("chronicle.empty")}</div>;
  }

  return (
    <div className="chronicle-panel">
      <ChronicleCanvas
        categoryChoices={categoryChoices}
        entries={activeChart.entries}
        hiddenCategoryKeys={hiddenCategoryKeys}
        onHiddenCategoryKeysChange={onHiddenCategoryKeysChange}
        onOpenFile={onOpenFile}
        onRailCollapsedChange={onRailCollapsedChange}
        railCollapsed={railCollapsed}
      />
    </div>
  );
}
