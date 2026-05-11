import { describe, expect, it } from "vitest";

import { extractChronicleRange } from "./chronicle";

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
