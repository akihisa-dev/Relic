import { describe, expect, it } from "vitest";

import { resolveAppFontFamily } from "./appFont";

describe("appFont", () => {
  it("日本語では日本語向けのゴシック体と明朝体を選ぶ", () => {
    expect(resolveAppFontFamily("gothic", "ja")).toContain("Hiragino Sans");
    expect(resolveAppFontFamily("mincho", "ja")).toContain("Hiragino Mincho ProN");
  });

  it("英語では英語向けのサンセリフ体とセリフ体を選ぶ", () => {
    expect(resolveAppFontFamily("gothic", "en")).toBe("Arial, Helvetica, sans-serif");
    expect(resolveAppFontFamily("mincho", "en")).toBe('Georgia, "Times New Roman", serif');
  });

  it("システム追従ではOS言語からフォント構成を選ぶ", () => {
    expect(resolveAppFontFamily("gothic", "system", "ja-JP")).toContain("Hiragino Sans");
    expect(resolveAppFontFamily("gothic", "system", "en-US")).toBe("Arial, Helvetica, sans-serif");
  });
});
