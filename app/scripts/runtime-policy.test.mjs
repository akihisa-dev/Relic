import { describe, expect, it } from "vitest";

import { supportedNodeMajors, validateNodeRuntime } from "./runtime-policy.mjs";

describe("runtime-policy", () => {
  it("単一メジャーのNode.js対応範囲を機械可読に解釈する", () => {
    expect(supportedNodeMajors(">=22 <27")).toEqual({ maximumExclusive: 27, minimum: 22 });
    expect(() => supportedNodeMajors(">=22")).toThrow("bounded major range");
  });

  it("対応メジャーだけを受理し、修正方法を含むエラーを返す", () => {
    expect(() => validateNodeRuntime(">=22 <27", "22.18.0")).not.toThrow();
    expect(() => validateNodeRuntime(">=22 <27", "26.4.0")).not.toThrow();
    expect(() => validateNodeRuntime(">=22 <27", "27.0.0")).toThrow(/corepack enable/u);
  });
});
