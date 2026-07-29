import {
  assertAppleSiliconHost,
  forgeDmgFileName,
  forgeBuildArguments,
  macBuildTarget
} from "./mac-build-target.mjs";

describe("mac-build-target", () => {
  it("Forgeの対象をmacOS arm64へ固定する", () => {
    expect(macBuildTarget).toEqual({
      arch: "arm64",
      dmgDirectory: "make",
      outputDirectory: "out/darwin",
      packageDirectoryName: "Relic-darwin-arm64",
      platform: "darwin"
    });
    expect(forgeBuildArguments("make")).toEqual([
      "exec",
      "electron-forge",
      "make",
      "--platform",
      "darwin",
      "--arch",
      "arm64"
    ]);
    expect(forgeBuildArguments("package")).toContain("arm64");
  });

  it("配布DMG名をアプリ版とarm64対象から決定する", () => {
    expect(forgeDmgFileName("1.2.3")).toBe("Relic-1.2.3-arm64.dmg");
    expect(() => forgeDmgFileName("1.2")).toThrow("MAJOR.MINOR.PATCH");
  });

  it("未対応のForgeコマンドを拒否する", () => {
    expect(() => forgeBuildArguments("publish")).toThrow("<make|package>");
  });

  it("Apple Silicon以外の実行環境を拒否する", () => {
    expect(() => assertAppleSiliconHost("darwin", "arm64")).not.toThrow();
    expect(() => assertAppleSiliconHost("darwin", "x64")).toThrow("darwin/x64");
    expect(() => assertAppleSiliconHost("linux", "arm64")).toThrow("linux/arm64");
  });
});
