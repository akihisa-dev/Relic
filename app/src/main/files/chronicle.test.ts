import { describe, expect, it } from "vitest";

import { extractChronicleRange, extractDateRange } from "./chronicle";

describe("extractChronicleRange", () => {
  it("単年を1要素配列として読む", () => {
    expect(extractChronicleRange("---\nchronicle: [1185]\n---\n# A")).toEqual({
      endYear: 1185,
      startYear: 1185
    });
  });

  it("期間を2要素配列として読む", () => {
    expect(extractChronicleRange("---\nchronicle: [-300, 250]\n---\n# A")).toEqual({
      endYear: 250,
      startYear: -300
    });
  });

  it("0年や逆順の期間は読まない", () => {
    expect(extractChronicleRange("---\nchronicle: [0]\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle: [1333, 1185]\n---\n# A")).toBeNull();
  });

  it("配列以外や3要素以上の配列は読まない", () => {
    expect(extractChronicleRange("---\nchronicle: 1185\n---\n# A")).toBeNull();
    expect(extractChronicleRange("---\nchronicle: [1185, 1333, 1600]\n---\n# A")).toBeNull();
  });
});

describe("extractDateRange", () => {
  it("単日を1要素配列として読む", () => {
    expect(extractDateRange("---\ndate: [2026-05-12]\n---\n# A")).toEqual({
      endDate: "2026-05-12",
      startDate: "2026-05-12"
    });
  });

  it("期間を2要素配列として読む", () => {
    expect(extractDateRange("---\ndate: [2026-05-12, 2026-05-20]\n---\n# A")).toEqual({
      endDate: "2026-05-20",
      startDate: "2026-05-12"
    });
  });

  it("不正な日付や逆順の期間は読まない", () => {
    expect(extractDateRange("---\ndate: ['2026-02-31']\n---\n# A")).toBeNull();
    expect(extractDateRange("---\ndate: [2026-05-20, 2026-05-12]\n---\n# A")).toBeNull();
  });
});
