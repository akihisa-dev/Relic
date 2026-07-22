import { describe, expect, it } from "vitest";

import {
  auditAsarEntries,
  isForbiddenAsarEntry,
  normalizeAsarEntry,
  renderPackageContentReport
} from "./package-content-report.mjs";

const requiredEntries = [
  "/package.json",
  "/.vite/build/main.js",
  "/.vite/build/preload.js",
  "/.vite/renderer/main_window/index.html",
  "/.vite/renderer/main_window/assets/index.js",
  "/assets/icon.iconset/icon_32x32.png"
];

describe("package-content-report", () => {
  it("必須entryが揃った最小packageを受け付ける", () => {
    expect(auditAsarEntries(requiredEntries)).toEqual({ forbidden: [], missing: [] });
  });

  it("相対ASAR entryを絶対形式へ正規化して監査する", () => {
    const relativeEntries = requiredEntries.map((entry) => entry.slice(1));

    expect(normalizeAsarEntry(".vite/build/main.js")).toBe("/.vite/build/main.js");
    expect(auditAsarEntries(relativeEntries)).toEqual({ forbidden: [], missing: [] });
  });

  it("source、test、cache、source map、開発設定を拒否する", () => {
    const forbidden = [
      "/src/main/main.ts",
      "/scripts/check.mjs",
      "/coverage/lcov.info",
      "/node_modules/react/index.js",
      "/.vite/renderer/main_window/assets/index.js.map",
      "/forge.config.ts",
      "/src/model.test.ts",
      "/.npmrc",
      "/assets/icon.icns"
    ];
    expect(forbidden.every(isForbiddenAsarEntry)).toBe(true);
    expect(auditAsarEntries([...requiredEntries, ...forbidden]).forbidden).toEqual(forbidden);
  });

  it("容量とファイル数をElectron本体と分けて表示する", () => {
    expect(renderPackageContentReport({
      appOwnedBytes: 120,
      appOwnedFileCount: 9,
      asarBytes: 100,
      asarFileCount: 6,
      legalFiles: [{ bytes: 20, path: "LICENSE" }]
    })).toContain("bytes\t120\nfiles\t9");
  });
});
