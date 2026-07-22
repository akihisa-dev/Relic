import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  ignoreRelicPackagePath,
  normalizePackagerPath,
  relicPackageExtraResources
} from "./packageContents";

describe("packageContents", () => {
  it.each([
    "/package.json",
    "/.vite",
    "/.vite/build/main.js",
    "/.vite/build/preload.js",
    "/.vite/renderer/main_window/index.html",
    "/.vite/renderer/main_window/assets/index.js",
    "/.vite/renderer/main_window/assets/KaTeX_Main-Regular.woff2",
    "/assets/icon.iconset/icon_32x32.png"
  ])("実行に必要なpackage内容を維持する: %s", (filePath) => {
    expect(ignoreRelicPackagePath(filePath)).toBe(false);
  });

  it.each([
    "/src/main/main.ts",
    "/src/main/main.test.ts",
    "/scripts/generate-icons.mjs",
    "/build-tools/packageContents.ts",
    "/coverage/lcov.info",
    "/dist/index.html",
    "/node_modules/react/index.js",
    "/.vite/renderer/main_window/assets/index.js.map",
    "/assets/icon.icns",
    "/assets/icon.iconset/icon_512x512@2x.png",
    "/pnpm-lock.yaml",
    "/tsconfig.json",
    "/vite.renderer.config.ts"
  ])("開発専用または重複したpackage内容を除外する: %s", (filePath) => {
    expect(ignoreRelicPackagePath(filePath)).toBe(true);
  });

  it("Packagerの相対pathを絶対形式へ正規化する", () => {
    expect(normalizePackagerPath(".vite/build/main.js")).toBe("/.vite/build/main.js");
  });

  it("LICENSE、第三者通知、SBOMを追加resourcesとして維持する", async () => {
    const resources = relicPackageExtraResources(process.cwd());
    expect(resources.map((filePath) => path.basename(filePath)))
      .toEqual(["LICENSE", "THIRD_PARTY_NOTICES.md", "sbom"]);
    await Promise.all(resources.map((filePath) => access(filePath)));
  });
});
