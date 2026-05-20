import { describe, expect, it } from "vitest";

import { donutGradient, percentage } from "./dashboardModel";

describe("dashboardModel display helpers", () => {
  it("builds an empty donut fallback when there are no values", () => {
    expect(donutGradient([])).toBe("var(--hover)");
  });

  it("builds deterministic donut segments from entry counts", () => {
    expect(donutGradient([
      { color: "#111", count: 2 },
      { color: "#222", count: 1 }
    ])).toBe("conic-gradient(#111 0deg 240deg, #222 240deg 360deg)");
  });

  it("keeps visible non-zero percentages above the minimum bar size", () => {
    expect(percentage(0, 10)).toBe(0);
    expect(percentage(1, 100)).toBe(4);
  });
});
