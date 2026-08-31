import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  auditAsarEntries,
  auditPackagedResourceEntries,
  isForbiddenAsarEntry,
  listPackagedResourceEntries,
  normalizeAsarEntry,
  requiredPackagedResourceEntries,
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

  it("ResourcesとSBOMが完全allowlistと一致するpackageだけを受け付ける", () => {
    expect(auditPackagedResourceEntries(requiredPackagedResourceEntries)).toEqual({
      missing: [],
      unexpected: []
    });
  });

  it("Resources直下またはSBOM内の余分なファイルを実filesystem fixtureで拒否する", async () => {
    const resources = await mkdtemp(path.join(os.tmpdir(), "relic-package-resources-"));
    try {
      for (const entry of requiredPackagedResourceEntries) {
        const absolutePath = path.join(resources, entry.slice(1));
        if (entry === "/sbom" || entry.endsWith(".lproj")) {
          await mkdir(absolutePath, { recursive: true });
        } else {
          await mkdir(path.dirname(absolutePath), { recursive: true });
          await writeFile(absolutePath, "fixture", "utf8");
        }
      }
      await writeFile(path.join(resources, "debug.log"), "unexpected", "utf8");
      await writeFile(
        path.join(resources, "sbom", "unexpected.cdx.json"),
        "unexpected",
        "utf8"
      );

      const audit = auditPackagedResourceEntries(
        await listPackagedResourceEntries(resources)
      );
      expect(audit).toEqual({
        missing: [],
        unexpected: ["/debug.log", "/sbom/unexpected.cdx.json"]
      });
    } finally {
      await rm(resources, { force: true, recursive: true });
    }
  });

  it("必須の第三者通知書またはSBOMが欠けたpackageを拒否する", () => {
    const entries = requiredPackagedResourceEntries.filter((entry) =>
      entry !== "/THIRD_PARTY_NOTICES.md"
      && entry !== "/sbom/relic-dependencies.cdx.json"
    );

    expect(auditPackagedResourceEntries(entries).missing).toEqual([
      "/THIRD_PARTY_NOTICES.md",
      "/sbom/relic-dependencies.cdx.json"
    ]);
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
