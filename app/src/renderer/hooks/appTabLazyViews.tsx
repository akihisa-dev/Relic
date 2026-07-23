import { lazy } from "react";
import type { ReactElement } from "react";

import { useT } from "../i18n";

export const LazyChartView = lazy(async () => ({
  default: (await import("../components/ChartPanel")).ChartView
}));
export const LazyCardView = lazy(async () => ({
  default: (await import("../components/CardView")).CardView
}));
export const LazyBubbleView = lazy(async () => ({
  default: (await import("../components/BubbleView")).BubbleView
}));
export const LazySphereView = lazy(async () => ({
  default: (await import("../components/SphereView")).SphereView
}));
export const LazyTableView = lazy(async () => ({
  default: (await import("../components/TableView")).TableView
}));
export const LazyFrontmatterPanel = lazy(async () => ({
  default: (await import("../components/FrontmatterPanel")).FrontmatterPanel
}));
export const LazySettingsPanel = lazy(async () => ({
  default: (await import("../components/SettingsPanel")).SettingsPanel
}));

export function LazyTabFallback(
  { visualization = false }: { visualization?: boolean }
): ReactElement {
  const t = useT();
  return (
    <div className={visualization ? "chart-view-status" : "list-loading-note"}>
      {t(visualization ? "visualization.loading" : "common.loading")}
    </div>
  );
}
