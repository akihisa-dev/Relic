import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export function median(values) {
  if (values.length === 0) {
    throw new Error("Cannot calculate a median without samples.");
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function compareLowerIsBetterMetrics(current, baseline, maxRegressionPercent) {
  if (!Number.isFinite(maxRegressionPercent) || maxRegressionPercent < 0) {
    throw new Error("maxRegressionPercent must be a non-negative number.");
  }

  const entries = [];
  const metricNames = [...new Set([...Object.keys(baseline), ...Object.keys(current)])]
    .sort((left, right) => left.localeCompare(right, "en"));

  for (const metric of metricNames) {
    const baselineValue = baseline[metric];
    const currentValue = current[metric];

    if (currentValue === undefined) continue;
    if (baselineValue === undefined) {
      entries.push({
        baseline: 0,
        current: currentValue,
        metric,
        regressionPercent: currentValue > 0 ? Number.POSITIVE_INFINITY : 0,
        regressed: currentValue > 0
      });
      continue;
    }

    const regressionPercent = baselineValue === 0
      ? (currentValue > 0 ? Number.POSITIVE_INFINITY : 0)
      : ((currentValue - baselineValue) / baselineValue) * 100;
    entries.push({
      baseline: baselineValue,
      current: currentValue,
      metric,
      regressionPercent,
      regressed: regressionPercent > maxRegressionPercent
    });
  }

  return {
    entries,
    maxRegressionPercent,
    regressions: entries.filter((entry) => entry.regressed)
  };
}

export function renderComparison(comparison) {
  const visibleEntries = comparison.entries.filter((entry) =>
    entry.regressed || !Number.isFinite(entry.regressionPercent) || Math.abs(entry.regressionPercent) >= 0.05
  );
  const lines = [
    `Regression threshold: ${comparison.maxRegressionPercent}%`,
    "status\tbaseline\tcurrent\tchange\tmetric"
  ];

  for (const entry of visibleEntries) {
    const change = Number.isFinite(entry.regressionPercent)
      ? `${entry.regressionPercent >= 0 ? "+" : ""}${entry.regressionPercent.toFixed(1)}%`
      : "+infinity";
    lines.push([
      entry.regressed ? "FAIL" : "PASS",
      entry.baseline,
      entry.current,
      change,
      entry.metric
    ].join("\t"));
  }

  lines.push("", `Compared ${comparison.entries.length} metric(s).`, comparison.regressions.length === 0
    ? "No regressions detected."
    : `${comparison.regressions.length} regression(s) detected.`);
  return lines.join("\n");
}

export async function readBaseline(filePath, expectedKind) {
  const parsed = JSON.parse(await readFile(filePath, "utf8"));
  if (parsed?.schemaVersion !== 1 || parsed?.kind !== expectedKind || typeof parsed.metrics !== "object") {
    throw new Error(`Invalid ${expectedKind} baseline: ${filePath}`);
  }
  return parsed;
}

export async function writeBaseline(filePath, baseline) {
  const resolvedPath = path.resolve(filePath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  return resolvedPath;
}
