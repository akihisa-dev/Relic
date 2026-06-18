import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { atomicWriteNewTextFile, atomicWriteTextFile, isAtomicWriteTemporaryPath } from "./atomicWrite";

describe("atomicWriteTextFile", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("一時ファイル書き込みに失敗した場合は元ファイル内容を残す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-atomic-write-"));
    temporaryPaths.push(workspacePath);
    const filePath = path.join(workspacePath, "note.md");
    const temporaryWrites: string[] = [];
    const unlink = vi.fn().mockResolvedValue(undefined);

    await writeFile(filePath, "original", "utf8");

    await expect(atomicWriteTextFile(filePath, "next", {
      rename: vi.fn(),
      unlink,
      writeFile: vi.fn().mockImplementation(async (temporaryPath: string) => {
        temporaryWrites.push(temporaryPath);
        throw new Error("disk full");
      })
    })).rejects.toThrow("disk full");

    await expect(readFile(filePath, "utf8")).resolves.toBe("original");
    expect(temporaryWrites).toHaveLength(1);
    expect(path.dirname(temporaryWrites[0])).toBe(workspacePath);
    expect(isAtomicWriteTemporaryPath(temporaryWrites[0])).toBe(true);
    expect(unlink).toHaveBeenCalledWith(temporaryWrites[0]);
  });

  it("一時ファイル名を判定できる", () => {
    expect(isAtomicWriteTemporaryPath("/tmp/workspace/.note.md.1234.1700000000000.xyz.tmp")).toBe(true);
    expect(isAtomicWriteTemporaryPath("/tmp/workspace/.note.md.tmp")).toBe(false);
    expect(isAtomicWriteTemporaryPath("/tmp/workspace/note.md")).toBe(false);
  });

  it("新規作成時に同名ファイルがある場合は元ファイル内容を残す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-atomic-write-new-"));
    temporaryPaths.push(workspacePath);
    const filePath = path.join(workspacePath, "note.md");
    const unlink = vi.fn().mockResolvedValue(undefined);

    await writeFile(filePath, "original", "utf8");

    await expect(atomicWriteNewTextFile(filePath, "next", {
      open: vi.fn().mockRejectedValue(Object.assign(new Error("exists"), { code: "EEXIST" })),
      unlink
    })).rejects.toMatchObject({ code: "EEXIST" });

    await expect(readFile(filePath, "utf8")).resolves.toBe("original");
    expect(unlink).not.toHaveBeenCalled();
  });

  it("新規作成時はhard linkを使わず排他的にファイルを作る", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-atomic-write-new-open-"));
    temporaryPaths.push(workspacePath);
    const filePath = path.join(workspacePath, "note.md");

    await expect(atomicWriteNewTextFile(filePath, "created")).resolves.toBeUndefined();

    await expect(readFile(filePath, "utf8")).resolves.toBe("created");
  });

  it("新規作成中に書き込みへ失敗した場合は作成途中のファイルを削除する", async () => {
    const filePath = path.join(path.sep, "workspace", "note.md");
    const close = vi.fn().mockResolvedValue(undefined);
    const unlink = vi.fn().mockResolvedValue(undefined);

    await expect(atomicWriteNewTextFile(filePath, "created", {
      open: vi.fn().mockResolvedValue({
        close,
        writeFile: vi.fn().mockRejectedValue(new Error("disk full"))
      }),
      unlink
    })).rejects.toThrow("disk full");

    expect(close).toHaveBeenCalledTimes(1);
    expect(unlink).toHaveBeenCalledWith(filePath);
  });
});
