import { mkdtemp, rm } from "node:fs/promises";
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
      expect(entries.value).toHaveLength(2);
      expect(entries.value.map((entry) => entry.size).toSorted()).toEqual([
        Buffer.byteLength("first", "utf8"),
        Buffer.byteLength("second", "utf8")
      ].toSorted());

      const snapshot = await readFileRecoverySnapshot(
        userDataPath,
        "workspace-a",
        "Notes/A.md",
        entries.value[0]!.id
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
      expect(entries.value).toHaveLength(1);

      const snapshot = await readFileRecoverySnapshot(userDataPath, "workspace-a", "A.md", entries.value[0]!.id);
      expect(snapshot.ok && snapshot.value.content).toBe("a");
    } finally {
      await rm(userDataPath, { force: true, recursive: true });
    }
  });
});
