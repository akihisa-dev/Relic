import { lazy } from "react";
import type { ReactElement } from "react";

import { useT } from "../i18n";

export const LazyChartView = lazy(() => import("./lazyViews/ChartView"));
export const LazyCardView = lazy(() => import("./lazyViews/CardView"));
export const LazyBubbleView = lazy(() => import("./lazyViews/BubbleView"));
export const LazySphereView = lazy(() => import("./lazyViews/SphereView"));
export const LazyTableView = lazy(() => import("./lazyViews/TableView"));
export const LazyFrontmatterPanel = lazy(() => import("./lazyViews/FrontmatterPanel"));
export const LazySettingsPanel = lazy(() => import("./lazyViews/SettingsPanel"));

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
