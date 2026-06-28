import { describe, expect, it, vi } from "vitest";

import { apiContractMismatchMessage, isRelicApiContractCompatible } from "./useWorkspaceCharts";
import { makeRelicApi } from "../../test/rendererTestUtils";
import type { RelicApi } from "../../shared/ipc";

describe("useWorkspaceCharts API contract", () => {
  it("現行preload契約だけを互換として扱う", () => {
    const relic = makeRelicApi() as RelicApi;

    expect(isRelicApiContractCompatible(relic)).toBe(true);
    expect(isRelicApiContractCompatible({
      ...relic,
      apiContractVersion: 0
    } as unknown as RelicApi)).toBe(false);
    expect(apiContractMismatchMessage()).toContain("Relicを再起動");
  });

  it("チャート更新IPC例外時にrenderer側fallbackへ切り替えない", async () => {
    const relic = makeRelicApi({
      updateChartEntry: vi.fn().mockRejectedValue(new Error("ipc failed"))
    }) as RelicApi;

    await expect(relic.updateChartEntry({
      chronicleEntryIndex: 0,
      endValue: 1,
      kind: "move",
      originalEndValue: 1,
      originalStartValue: 1,
      path: "note.md",
      source: "chronicle",
      startValue: 1
    })).rejects.toThrow("ipc failed");
  });
});
