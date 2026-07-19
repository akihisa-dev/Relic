import type { ReactElement } from "react";

import type { WorkspaceChart } from "../../shared/ipc";
import type { ChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import { useT } from "../i18n";
import { ChronicleCanvas } from "./ChronicleCanvas";

interface ChartViewProps {
  categoryChoices?: string[];
  calendarSettings?: ChronicleCalendarSettings;
  chart?: WorkspaceChart | null;
  charts?: WorkspaceChart[];
  hiddenCategoryKeys?: string[];
  onOpenFile: (path: string) => void;
  onHiddenCategoryKeysChange?: (keys: string[]) => void;
  onCalendarSettingsSave?: (settings: ChronicleCalendarSettings) => void;
  onRailCollapsedChange?: (collapsed: boolean) => void;
  railCollapsed?: boolean;
}

const defaultCharts: WorkspaceChart[] = [];

export function ChartView({
  categoryChoices,
  calendarSettings,
  chart = null,
  charts = defaultCharts,
  hiddenCategoryKeys,
  onHiddenCategoryKeysChange,
  onCalendarSettingsSave,
  onOpenFile,
  onRailCollapsedChange,
  railCollapsed
}: ChartViewProps): ReactElement {
  const t = useT();
  const activeChart = chart ?? charts[0] ?? null;

  if (!activeChart) {
    return <div className="frontmatter-field-empty chronicle-canvas-empty">{t("chronicle.empty")}</div>;
  }

  return (
    <div className="chronicle-panel">
      <ChronicleCanvas
        calendarSettings={calendarSettings}
        categoryChoices={categoryChoices}
        entries={activeChart.entries}
        hiddenCategoryKeys={hiddenCategoryKeys}
        onHiddenCategoryKeysChange={onHiddenCategoryKeysChange}
        onCalendarSettingsSave={onCalendarSettingsSave}
        onOpenFile={onOpenFile}
        onRailCollapsedChange={onRailCollapsedChange}
        railCollapsed={railCollapsed}
      />
    </div>
  );
}
