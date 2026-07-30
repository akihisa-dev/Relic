import { createHash } from "node:crypto";
import { mkdtemp, readdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  createFileRecoverySnapshot,
  listFileRecoverySnapshots,
  readFileRecoverySnapshot
} from "./fileRecovery";

describe("fileRecovery", () => {
  it("保存した復元版を一覧し、本文を読み込める", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-file-recovery-"));

    try {
      const first = await createFileRecoverySnapshot(userDataPath, "workspace-a", "Notes/A.md", "first");
      const second = await createFileRecoverySnapshot(userDataPath, "workspace-a", "Notes/A.md", "second");

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);

      const entries = await listFileRecoverySnapshots(userDataPath, "workspace-a", "Notes/A.md");
      expect(entries.ok).toBe(true);
      if (!entries.ok) return;
      expect(entries.value.unreadableCount).toBe(0);
      expect(entries.value.entries).toHaveLength(2);
      expect(entries.value.entries.map((entry) => entry.size).toSorted()).toEqual([
        Buffer.byteLength("first", "utf8"),
        Buffer.byteLength("second", "utf8")
      ].toSorted());

      const snapshot = await readFileRecoverySnapshot(
        userDataPath,
        "workspace-a",
        "Notes/A.md",
        entries.value.entries[0]!.id
      );
      expect(snapshot).toEqual({
        ok: true,
        value: expect.objectContaining({
          content: expect.stringMatching(/^(first|second)$/),
          path: "Notes/A.md",
          workspaceId: "workspace-a"
        })
      });
    } finally {
      await rm(userDataPath, { force: true, recursive: true });
    }
  });

  it("別ワークスペースまたは別ファイルの復元版を混ぜない", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-file-recovery-"));

    try {
      await createFileRecoverySnapshot(userDataPath, "workspace-a", "A.md", "a");
      await createFileRecoverySnapshot(userDataPath, "workspace-b", "A.md", "b");
      await createFileRecoverySnapshot(userDataPath, "workspace-a", "B.md", "c");

      const entries = await listFileRecoverySnapshots(userDataPath, "workspace-a", "A.md");
      expect(entries.ok).toBe(true);
      if (!entries.ok) return;
      expect(entries.value.entries).toHaveLength(1);

      const snapshot = await readFileRecoverySnapshot(
        userDataPath,
        "workspace-a",
        "A.md",
        entries.value.entries[0]!.id
      );
      expect(snapshot.ok && snapshot.value.content).toBe("a");
    } finally {
      await rm(userDataPath, { force: true, recursive: true });
    }
  });

  it("壊れたJSONと不正形式を個別に除外し、正常な復元版を利用できる", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-file-recovery-"));
    const relativePath = "Notes/A.md";

    try {
      await createFileRecoverySnapshot(userDataPath, "workspace-a", relativePath, "available");
      const snapshotDir = recoveryDirectory(userDataPath, "workspace-a", relativePath);
      await writeFile(path.join(snapshotDir, "broken-aaaaaaaaaaaa.json"), "{\"content\":", "utf8");
      await writeFile(path.join(snapshotDir, "invalid-bbbbbbbbbbbb.json"), JSON.stringify({
        content: 42,
        createdAt: "2026-07-30T00:00:00.000Z",
        path: relativePath,
        size: 2,
        workspaceId: "workspace-a"
      }), "utf8");

      const result = await listFileRecoverySnapshots(userDataPath, "workspace-a", relativePath);

      expect(result).toEqual({
        ok: true,
        value: {
          entries: [
            expect.objectContaining({
              path: relativePath,
              size: Buffer.byteLength("available", "utf8")
            })
          ],
          unreadableCount: 2
        }
      });
      const entry = result.ok ? result.value.entries[0] : undefined;
      expect(entry).toBeDefined();
      if (!entry) return;
      await expect(readFileRecoverySnapshot(
        userDataPath,
        "workspace-a",
        relativePath,
        entry.id
      )).resolves.toMatchObject({
        ok: true,
        value: { content: "available" }
      });
      await expect(readdir(snapshotDir)).resolves.toEqual(expect.arrayContaining([
        "broken-aaaaaaaaaaaa.json",
        "invalid-bbbbbbbbbbbb.json"
      ]));
    } finally {
      await rm(userDataPath, { force: true, recursive: true });
    }
  });

  it("保存途中の一時ファイルを一覧対象にしない", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-file-recovery-"));
    const relativePath = "A.md";

    try {
      await createFileRecoverySnapshot(userDataPath, "workspace-a", relativePath, "available");
      const snapshotDir = recoveryDirectory(userDataPath, "workspace-a", relativePath);
      await writeFile(
        path.join(snapshotDir, ".pending.json.123.456.temporary.tmp"),
        "{\"content\":",
        "utf8"
      );

      const result = await listFileRecoverySnapshots(userDataPath, "workspace-a", relativePath);

      expect(result.ok && result.value.entries).toHaveLength(1);
      expect(result.ok && result.value.unreadableCount).toBe(0);
    } finally {
      await rm(userDataPath, { force: true, recursive: true });
    }
  });

  it("保存途中に失敗しても不完全な最終JSONや一時ファイルを残さない", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-file-recovery-"));

    try {
      const result = await createFileRecoverySnapshot(
        userDataPath,
        "workspace-a",
        "A.md",
        "content",
        {
          rename,
          unlink,
          writeFile: async (targetPath, content, options) => {
            await writeFile(targetPath, content.toString().slice(0, 8), options);
            throw new Error("interrupted");
          }
        }
      );

      expect(result).toMatchObject({
        error: { code: "FILE_RECOVERY_SAVE_FAILED" },
        ok: false
      });
      const recoveryFiles = await readdir(path.join(userDataPath, "file-recovery"), {
        recursive: true
      });
      expect(recoveryFiles.filter((fileName) => fileName.endsWith(".json"))).toEqual([]);
      expect(recoveryFiles.filter((fileName) => fileName.endsWith(".tmp"))).toEqual([]);
    } finally {
      await rm(userDataPath, { force: true, recursive: true });
    }
  });

  it("正常な復元版を1ファイルにつき最大30件に保つ", async () => {
    const userDataPath = await mkdtemp(path.join(os.tmpdir(), "relic-file-recovery-"));

    try {
      for (let index = 0; index < 31; index += 1) {
        const result = await createFileRecoverySnapshot(
          userDataPath,
          "workspace-a",
          "A.md",
          `content-${index}`
        );
        expect(result.ok).toBe(true);
      }

      const result = await listFileRecoverySnapshots(userDataPath, "workspace-a", "A.md");
      expect(result.ok && result.value.entries).toHaveLength(30);
      expect(result.ok && result.value.unreadableCount).toBe(0);
    } finally {
      await rm(userDataPath, { force: true, recursive: true });
    }
  });
});

function recoveryDirectory(userDataPath: string, workspaceId: string, relativePath: string): string {
  return path.join(
    userDataPath,
    "file-recovery",
    workspaceId,
    createHash("sha256").update(relativePath).digest("hex")
  );
}
