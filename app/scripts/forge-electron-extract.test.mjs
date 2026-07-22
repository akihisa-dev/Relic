import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { nodeMajorVersion, shouldUseDitto } = require("./forge-electron-extract.cjs");

describe("forge-electron-extract", () => {
  it("Node.jsのメジャーバージョンを判定する", () => {
    expect(nodeMajorVersion("26.4.0")).toBe(26);
    expect(nodeMajorVersion("invalid")).toBe(0);
  });

  it("Node.js 25以降のmacOS配布時だけdittoへ切り替える", () => {
    expect(shouldUseDitto({ enabled: "ditto", nodeVersion: "26.4.0", platform: "darwin" })).toBe(true);
    expect(shouldUseDitto({ enabled: "ditto", nodeVersion: "24.14.0", platform: "darwin" })).toBe(false);
    expect(shouldUseDitto({ enabled: "ditto", nodeVersion: "26.4.0", platform: "linux" })).toBe(false);
    expect(shouldUseDitto({ enabled: "extract-zip", nodeVersion: "26.4.0", platform: "darwin" })).toBe(false);
  });
});
