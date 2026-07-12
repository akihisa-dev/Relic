import { describe, expect, it } from "vitest";

import {
  buildWorkspacePerformanceMetrics,
  renderWorkspacePerformanceReport,
  startProcessMemorySampler,
  summarizeMemoryRuns
} from "./workspace-performance-report.mjs";

describe("workspace-performance-report", () => {
  it("fixture、各処理の中央値、I/O回数を表示する", () => {
    const scenarios = Object.fromEntries([
      "fileTree",
      "fileIndex",
      "incrementalRefresh",
      "contentSearch",
      "tags",
      "backlinks",
      "graph",
      "chronicle"
    ].map((name) => [name, { maximumMs: 12, medianMs: 10, minimumMs: 8 }]));
    const report = renderWorkspacePerformanceReport({
      fixture: { directoryCount: 20, fileCount: 1000, fingerprint: "abc" },
      indexStats: { readFileCount: 1000, statCount: 1000 },
      incrementalStats: { readFileCount: 1, statCount: 1 },
      memory: {
        garbageCollection: "forced-before-run",
        heapUsed: { maximumBytes: 150, maximumIncreaseBytes: 50, startMedianBytes: 100 },
        rss: { maximumBytes: 1200, maximumIncreaseBytes: 200, startMedianBytes: 1000 }
      },
      observations: { graphNodes: 1012 },
      runs: 5,
      scenarios,
      warmups: 1
    });

    expect(report).toContain("fixture\t1000 files\t20 directories\tabc");
    expect(report).toContain("fileIndex\t10\t8\t12");
    expect(report).toContain("readFileCount\t1000");
    expect(report).toContain("Incremental refresh operations (median)");
    expect(report).toContain("readFileCount\t1");
    expect(report).toContain("Process memory (measured runs)");
    expect(report).toContain("heapUsed\t100\t150\t50");
    expect(report).toContain("rss\t1000\t1200\t200");
  });

  it("process memoryの開始値、最大値、増分をサンプリングする", () => {
    const readings = [
      { heapUsed: 100, rss: 1000 },
      { heapUsed: 150, rss: 900 },
      { heapUsed: 120, rss: 1200 }
    ];
    const sampler = startProcessMemorySampler({
      intervalMs: 0,
      readMemory: () => readings.shift()
    });
    sampler.sample();

    expect(sampler.finish()).toEqual({
      heapUsed: { increaseBytes: 50, maximumBytes: 150, startBytes: 100 },
      rss: { increaseBytes: 200, maximumBytes: 1200, startBytes: 1000 },
      samples: 3
    });
  });

  it("複数runの開始中央値と最大値を集約する", () => {
    const runs = [
      { heapUsed: { increaseBytes: 50, maximumBytes: 150, startBytes: 100 } },
      { heapUsed: { increaseBytes: 40, maximumBytes: 160, startBytes: 120 } }
    ];
    expect(summarizeMemoryRuns(runs, "heapUsed")).toEqual({
      maximumBytes: 160,
      maximumIncreaseBytes: 50,
      startMedianBytes: 110
    });
  });

  it("メモリ値をCI回帰判定metricsへ含めない", () => {
    const metrics = buildWorkspacePerformanceMetrics(
      { graph: { medianMs: 12 } },
      { readFileCount: 1000, readHeadCount: 0, statCount: 1000 },
      { readFileCount: 1, readHeadCount: 0, statCount: 1 }
    );

    expect(metrics).toEqual({
      "duration.graph.medianMs": 12,
      "operation.fileIndex.readFileCount": 1000,
      "operation.fileIndex.readHeadCount": 0,
      "operation.fileIndex.statCount": 1000,
      "operation.incrementalRefresh.readFileCount": 1,
      "operation.incrementalRefresh.readHeadCount": 0,
      "operation.incrementalRefresh.statCount": 1
    });
    expect(Object.keys(metrics).some((name) => name.includes("memory"))).toBe(false);
  });
});
