import { chmod, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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

  it("指定されたmodeで一時ファイルを作成し、最終ファイルにも引き継ぐ", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-atomic-write-mode-"));
    temporaryPaths.push(workspacePath);
    const filePath = path.join(workspacePath, "settings.json");
    const seenOptions: Array<BufferEncoding | { encoding?: BufferEncoding; mode?: number } | undefined> = [];

    await atomicWriteTextFile(filePath, "private", {
      rename: async (from, to) => {
        await import("node:fs/promises").then((fs) => fs.rename(from, to));
      },
      unlink: async (targetPath) => {
        await import("node:fs/promises").then((fs) => fs.unlink(targetPath));
      },
      writeFile: async (targetPath, content, options) => {
        seenOptions.push(options);
        await import("node:fs/promises").then((fs) => fs.writeFile(targetPath, content, options));
      }
    }, { mode: 0o600 });

    expect(seenOptions).toEqual([{ encoding: "utf8", mode: 0o600 }]);
    if (process.platform !== "win32") {
      expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    }
  });

  it.runIf(process.platform !== "win32")("既存ファイルのmodeを安全書き込み後も保持する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-atomic-write-existing-mode-"));
    temporaryPaths.push(workspacePath);
    const filePath = path.join(workspacePath, "note.md");

    await writeFile(filePath, "original", "utf8");
    await chmod(filePath, 0o600);
    await atomicWriteTextFile(filePath, "updated");

    await expect(readFile(filePath, "utf8")).resolves.toBe("updated");
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    await expect(readdir(workspacePath)).resolves.toEqual(["note.md"]);
  });

  it.runIf(process.platform !== "win32")("置換失敗時は元内容と元modeを保持して一時ファイルを残さない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-atomic-write-failed-mode-"));
    temporaryPaths.push(workspacePath);
    const filePath = path.join(workspacePath, "note.md");

    await writeFile(filePath, "original", "utf8");
    await chmod(filePath, 0o600);

    await expect(atomicWriteTextFile(filePath, "updated", {
      rename: vi.fn().mockRejectedValue(new Error("rename failed")),
      unlink: async (targetPath) => {
        await import("node:fs/promises").then((fs) => fs.unlink(targetPath));
      },
      writeFile: async (targetPath, content, options) => {
        await import("node:fs/promises").then((fs) => fs.writeFile(targetPath, content, options));
      }
    })).rejects.toThrow("rename failed");

    await expect(readFile(filePath, "utf8")).resolves.toBe("original");
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    await expect(readdir(workspacePath)).resolves.toEqual(["note.md"]);
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
