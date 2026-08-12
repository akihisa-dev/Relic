import { mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { updateLinksForFileRename } from "./linkUpdater";
import { writeMarkdownFileContent } from "./markdownFileContent";
import {
  captureMarkdownMutationSnapshot,
  MarkdownMutationConflictError,
  maxMarkdownMutationReadBytes,
  runMarkdownFileMutation
} from "./markdownMutationCoordinator";
import { replaceInFile } from "./replace";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("markdown mutation coordinator", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) => rm(temporaryPath, { force: true, recursive: true }))
    );
  });

  it("同じ実体のexpected taskを直列化し、一方だけを成功させる", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-mutation-queue-"));
    temporaryPaths.push(workspacePath);
    const filePath = path.join(workspacePath, "note.md");
    await writeFile(filePath, "old", "utf8");

    const firstStarted = deferred();
    const releaseFirst = deferred();
    const first = runMarkdownFileMutation(filePath, async () => {
      firstStarted.resolve();
      await releaseFirst.promise;
      const snapshot = await captureMarkdownMutationSnapshot(filePath);
      if (snapshot.content !== "old") throw new MarkdownMutationConflictError();
      await writeFile(filePath, "A", "utf8");
    });
    await firstStarted.promise;

    const second = runMarkdownFileMutation(filePath, async () => {
      const snapshot = await captureMarkdownMutationSnapshot(filePath);
      if (snapshot.content !== "old") throw new MarkdownMutationConflictError();
      await writeFile(filePath, "B", "utf8");
    });

    releaseFirst.resolve();
    await expect(first).resolves.toBeUndefined();
    await expect(second).rejects.toBeInstanceOf(MarkdownMutationConflictError);
    await expect(readFile(filePath, "utf8")).resolves.toBe("A");
  });

  it("先行taskの失敗後も同じpathのqueueを回復する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-mutation-recovery-"));
    temporaryPaths.push(workspacePath);
    const filePath = path.join(workspacePath, "note.md");
    await writeFile(filePath, "old", "utf8");

    await expect(runMarkdownFileMutation(filePath, async () => {
      throw new Error("disk full");
    })).rejects.toThrow("disk full");

    await expect(runMarkdownFileMutation(filePath, async () => {
      await writeFile(filePath, "next", "utf8");
    })).resolves.toBeUndefined();
    await expect(readFile(filePath, "utf8")).resolves.toBe("next");
  });

  it("statのサイズ上限超過時は本文を読み込まない", async () => {
    const readFileOperation = vi.fn();
    await expect(captureMarkdownMutationSnapshot("/tmp/oversize.md", {
      stat: async () => ({ size: maxMarkdownMutationReadBytes + 1, dev: 1, ino: 1, mtimeMs: 1 }),
      readFile: readFileOperation
    })).rejects.toMatchObject({ code: "MARKDOWN_MUTATION_READ_TOO_LARGE" });
    expect(readFileOperation).not.toHaveBeenCalled();
  });

  it("stat後に本文が上限を超えた場合は読み込み結果を拒否する", async () => {
    const readFileOperation = vi.fn().mockResolvedValue("x".repeat(maxMarkdownMutationReadBytes + 1));
    await expect(captureMarkdownMutationSnapshot("/tmp/grown.md", {
      stat: async () => ({ size: 1, dev: 1, ino: 1, mtimeMs: 1 }),
      readFile: readFileOperation
    })).rejects.toMatchObject({ code: "MARKDOWN_MUTATION_READ_TOO_LARGE" });
    expect(readFileOperation).toHaveBeenCalledTimes(1);
  });

  it("異なるrealpathのtaskは並列に進む", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-mutation-parallel-"));
    temporaryPaths.push(workspacePath);
    const firstPath = path.join(workspacePath, "first.md");
    const secondPath = path.join(workspacePath, "second.md");
    await writeFile(firstPath, "old", "utf8");
    await writeFile(secondPath, "old", "utf8");

    let active = 0;
    let maximumActive = 0;
    const task = async (filePath: string): Promise<void> => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
      await writeFile(filePath, "next", "utf8");
    };

    await Promise.all([
      runMarkdownFileMutation(firstPath, () => task(firstPath)),
      runMarkdownFileMutation(secondPath, () => task(secondPath))
    ]);

    expect(maximumActive).toBe(2);
  });

  it("replaceとlink更新の交差で後着writerが古い本文を上書きしない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-mutation-cross-"));
    temporaryPaths.push(workspacePath);
    const sourcePath = path.join(workspacePath, "source.md");
    await writeFile(sourcePath, "[[old]]", "utf8");
    await writeFile(path.join(workspacePath, "new.md"), "", "utf8");

    const replaceWriteStarted = deferred();
    const releaseReplace = deferred();
    const replacePromise = replaceInFile(workspacePath, "source.md", "old", "replacement", false, {
      readFile,
      async writeTextFile(filePath, content) {
        replaceWriteStarted.resolve();
        await releaseReplace.promise;
        await writeFile(filePath, content, "utf8");
      },
      stat
    });
    await replaceWriteStarted.promise;

    const linkReadCaptured = deferred();
    let sourceReadCount = 0;
    const linkPromise = updateLinksForFileRename(workspacePath, "old.md", "new.md", {
      async readFile(filePath, encoding) {
        const content = await readFile(filePath, encoding);
        if (filePath === sourcePath && sourceReadCount === 0) {
          sourceReadCount += 1;
          linkReadCaptured.resolve();
        }
        return content;
      },
      stat,
      writeTextFile: async (filePath, content) => {
        await writeFile(filePath, content, "utf8");
      }
    });
    await linkReadCaptured.promise;
    releaseReplace.resolve();

    await expect(replacePromise).resolves.toMatchObject({ ok: true, value: { count: 1 } });
    await expect(linkPromise).resolves.toMatchObject({
      error: expect.objectContaining({ code: "LINK_UPDATE_CONFLICT" }),
      ok: false
    });
    await expect(readFile(sourcePath, "utf8")).resolves.toBe("[[replacement]]");
  });
});

describe("writeMarkdownFileContent mutation guard", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) => rm(temporaryPath, { force: true, recursive: true }))
    );
  });

  it("同じexpectedContentの同時保存はqueue順に一方だけ成功する", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-mutation-editor-queue-"));
    temporaryPaths.push(workspacePath);
    const filePath = path.join(workspacePath, "note.md");
    await writeFile(filePath, "old", "utf8");

    const firstStarted = deferred();
    const releaseFirst = deferred();
    const first = writeMarkdownFileContent(
      workspacePath,
      "note.md",
      "first",
      "old",
      {},
      async () => {
        firstStarted.resolve();
        await releaseFirst.promise;
        return { ok: true, value: undefined };
      }
    );
    await firstStarted.promise;

    const second = writeMarkdownFileContent(workspacePath, "note.md", "second", "old");
    releaseFirst.resolve();

    await expect(first).resolves.toMatchObject({ ok: true });
    await expect(second).resolves.toMatchObject({
      error: { code: "FILE_WRITE_CONFLICT" },
      ok: false
    });
    await expect(readFile(filePath, "utf8")).resolves.toBe("first");
  });

  it("rename直前の再検証で外部変更を検知し、一時ファイルを公開しない", async () => {
    const workspacePath = await mkdtemp(path.join(os.tmpdir(), "relic-mutation-conflict-"));
    temporaryPaths.push(workspacePath);
    const filePath = path.join(workspacePath, "note.md");
    await writeFile(filePath, "old", "utf8");

    let statCalls = 0;
    const result = await writeMarkdownFileContent(
      workspacePath,
      "note.md",
      "relic",
      "old",
      {
        readFile,
        realpath,
        stat: async (candidate) => {
          const current = await stat(candidate);
          statCalls += 1;
          if (statCalls === 1) await writeFile(filePath, "external", "utf8");
          return current;
        }
      }
    );

    expect(result).toMatchObject({
      error: { code: "FILE_WRITE_CONFLICT" },
      ok: false
    });
    await expect(readFile(filePath, "utf8")).resolves.toBe("external");
  });
});
