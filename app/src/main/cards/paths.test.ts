import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  resolveCardbookRelativePath,
  resolveCardbookRelativePathOrRoot,
  toCardbookRelativePath
} from "./paths";

describe("resolveCardbookRelativePath", () => {
  it("カードブック内の相対パスを絶対パスへ解決する", () => {
    expect(resolveCardbookRelativePath("/tmp/relic-notes", "notes/idea.md")).toEqual({
      ok: true,
      value: path.resolve("/tmp/relic-notes", "notes", "idea.md")
    });
  });

  it("絶対パスとカードブック外への参照を拒否する", () => {
    expect(resolveCardbookRelativePath("/tmp/relic-notes", "/tmp/other.md").ok).toBe(false);
    expect(resolveCardbookRelativePath("/tmp/relic-notes", "C:\\Users\\test\\note.md").ok).toBe(false);
    expect(resolveCardbookRelativePath("/tmp/relic-notes", "\\\\server\\share\\note.md").ok).toBe(false);
    expect(resolveCardbookRelativePath("/tmp/relic-notes", "../other.md").ok).toBe(false);
  });
});

describe("resolveCardbookRelativePathOrRoot", () => {
  it("空文字とドットをカードブック直下として扱う", () => {
    expect(resolveCardbookRelativePathOrRoot("/tmp/relic-notes", "")).toEqual({
      ok: true,
      value: "/tmp/relic-notes"
    });
    expect(resolveCardbookRelativePathOrRoot("/tmp/relic-notes", ".")).toEqual({
      ok: true,
      value: "/tmp/relic-notes"
    });
  });

  it("カードブック外への参照は拒否する", () => {
    expect(resolveCardbookRelativePathOrRoot("/tmp/relic-notes", "../other").ok).toBe(false);
    expect(resolveCardbookRelativePathOrRoot("/tmp/relic-notes", "/tmp/other").ok).toBe(false);
  });
});

describe("toCardbookRelativePath", () => {
  it("OS のパス区切りをカードブック相対パスの区切りへ正規化する", () => {
    expect(toCardbookRelativePath(path.join("notes", "idea.md"))).toBe("notes/idea.md");
  });
});
