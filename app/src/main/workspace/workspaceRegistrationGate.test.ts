import { describe, expect, it } from "vitest";

import { runWorkspaceRegistrationTask } from "./workspaceRegistrationGate";

describe("workspace registration gate", () => {
  it("保持中のtaskをFIFOで待機させる", async () => {
    let releaseFirst!: () => void;
    const first = runWorkspaceRegistrationTask(() => new Promise<string>((resolve) => {
      releaseFirst = () => resolve("first");
    }));
    const events: string[] = [];
    const second = runWorkspaceRegistrationTask(async () => {
      events.push("second");
      return "second";
    });

    await Promise.resolve();
    expect(events).toEqual([]);
    releaseFirst();

    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
    expect(events).toEqual(["second"]);
  });

  it("task失敗後も後続taskを実行し、失敗を呼出元へ返す", async () => {
    const failure = runWorkspaceRegistrationTask(async () => {
      throw new Error("expected failure");
    });
    const next = runWorkspaceRegistrationTask(() => "after failure");

    await expect(failure).rejects.toThrow("expected failure");
    await expect(next).resolves.toBe("after failure");
  });

  it("先行する登録変更後に後続保存が最新IDを参照する", async () => {
    let releaseRename!: () => void;
    let registeredId = "old-id";
    const rename = runWorkspaceRegistrationTask(async () => {
      await new Promise<void>((resolve) => {
        releaseRename = resolve;
      });
      registeredId = "new-id";
    });
    const save = runWorkspaceRegistrationTask(() => registeredId);

    releaseRename();
    await expect(rename).resolves.toBeUndefined();
    await expect(save).resolves.toBe("new-id");
  });
});
