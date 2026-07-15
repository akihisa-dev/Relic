import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  generateLargeWorkspace,
  positiveInteger,
  renderLargeWorkspaceNote
} from "./generate-large-workspace.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { force: true, recursive: true })
  ));
});

describe("generate-large-workspace", () => {
  it("同じ条件から同一内容とfingerprintを生成する", async () => {
    const firstRoot = await mkdtemp(path.join(os.tmpdir(), "relic-large-first-"));
    const secondRoot = await mkdtemp(path.join(os.tmpdir(), "relic-large-second-"));
    temporaryDirectories.push(firstRoot, secondRoot);

    const first = await generateLargeWorkspace({ directoryCount: 3, fileCount: 8, outputPath: firstRoot });
    const second = await generateLargeWorkspace({ directoryCount: 3, fileCount: 8, outputPath: secondRoot });

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(await readFile(path.join(firstRoot, "section-000", "note-00001.md"), "utf8"))
      .toBe(await readFile(path.join(secondRoot, "section-000", "note-00001.md"), "utf8"));
    expect(await readFile(path.join(firstRoot, "section-001", "note-00008.md"), "utf8"))
      .toContain("[[note-00007]]");
  });

  it("リンク、タグ、年表を含む固定fixture本文を返す", () => {
    const note = renderLargeWorkspaceNote(0, 10);
    expect(note).toContain("  - tag-0");
    expect(note).toContain("[[note-00008]]");
    expect(note).toContain("chronicle: 2000");
  });

  it("正の整数だけを受け付ける", () => {
    expect(positiveInteger("5", "files")).toBe(5);
    expect(() => positiveInteger("0", "files")).toThrow("--files must be a positive integer.");
    expect(() => positiveInteger("1.5", "files")).toThrow("--files must be a positive integer.");
  });
});
