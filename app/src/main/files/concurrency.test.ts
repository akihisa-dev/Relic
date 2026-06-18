import { describe, expect, it } from "vitest";

import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  it("fake処理で最大同時実行数を上限内に抑える", async () => {
    let active = 0;
    let maxActive = 0;

    await mapWithConcurrency(
      ["first", "second", "third", "fourth"],
      2,
      async (item) => {
        active += 1;
        maxActive = Math.max(maxActive, active);

        await new Promise((resolve) => setTimeout(resolve, item === "first" ? 40 : 0));
        const value = item;
        active -= 1;
        return value;
      }
    );

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("処理順序を保持する", async () => {
    const result = await mapWithConcurrency(
      ["first", "second", "third", "fourth"],
      2,
      async (item) => {
        const delayMs = item === "first" ? 40 : item === "second" ? 10 : 20;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return item;
      }
    );

    expect(result).toEqual(["first", "second", "third", "fourth"]);
  });
});
