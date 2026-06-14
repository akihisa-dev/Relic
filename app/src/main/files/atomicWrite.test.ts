import { link, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { atomicWriteNewTextFile, atomicWriteTextFile } from "./atomicWrite";

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
    expect(unlink).toHaveBeenCalledWith(temporaryWrites[0]);
  });

  it("新規作成時に同名ファイルがある場合は元ファイル内容を残す", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-atomic-write-new-"));
    temporaryPaths.push(workspacePath);
    const filePath = path.join(workspacePath, "note.md");
    const temporaryWrites: string[] = [];
    const unlink = vi.fn().mockResolvedValue(undefined);

    await writeFile(filePath, "original", "utf8");

    await expect(atomicWriteNewTextFile(filePath, "next", {
      link: vi.fn().mockRejectedValue(Object.assign(new Error("exists"), { code: "EEXIST" })),
      rename: vi.fn(),
      unlink,
      writeFile: vi.fn().mockImplementation(async (temporaryPath: string) => {
        temporaryWrites.push(temporaryPath);
      })
    })).rejects.toMatchObject({ code: "EEXIST" });

    await expect(readFile(filePath, "utf8")).resolves.toBe("original");
    expect(temporaryWrites).toHaveLength(1);
    expect(path.dirname(temporaryWrites[0])).toBe(workspacePath);
    expect(unlink).toHaveBeenCalledWith(temporaryWrites[0]);
  });

  it("新規作成済みなら一時ファイル削除に失敗しても成功扱いにする", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-atomic-write-new-cleanup-"));
    temporaryPaths.push(workspacePath);
    const filePath = path.join(workspacePath, "note.md");
    const unlink = vi.fn().mockRejectedValue(new Error("cleanup failed"));

    await expect(atomicWriteNewTextFile(filePath, "created", {
      link,
      rename: vi.fn(),
      unlink,
      writeFile
    })).resolves.toBeUndefined();

    await expect(readFile(filePath, "utf8")).resolves.toBe("created");
    expect(unlink).toHaveBeenCalledTimes(1);
  });
});
