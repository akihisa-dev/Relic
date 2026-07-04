import { performance } from "node:perf_hooks";

export interface PerformanceMeasure {
  details?: Record<string, number | string | boolean | null | undefined>;
  durationMs: number;
  label: string;
}

export function startPerformanceMeasure(): number {
  return performance.now();
}

export function finishPerformanceMeasure(
  label: string,
  startedAt: number,
  details?: PerformanceMeasure["details"]
): PerformanceMeasure {
  const measure = {
    details,
    durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    label
  };
  logPerformanceMeasure(measure);
  return measure;
}

export function logPerformanceMeasure(measure: PerformanceMeasure): void {
  if (!isPerformanceLoggingEnabled()) return;

  const detailText = measure.details
    ? ` ${JSON.stringify(measure.details)}`
    : "";
  console.info(`[Relic performance] ${measure.label}: ${measure.durationMs}ms${detailText}`);
}

export function isPerformanceLoggingEnabled(): boolean {
  return process.env.RELIC_PERFORMANCE_LOG === "1" || process.env.NODE_ENV !== "production";
}
