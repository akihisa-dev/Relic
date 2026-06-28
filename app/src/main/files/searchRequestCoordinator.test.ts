import { describe, expect, it } from "vitest";

import { WorkspaceSearchRequestCoordinator, type SearchRequestContext } from "./searchRequestCoordinator";

describe("WorkspaceSearchRequestCoordinator", () => {
  it("同じワークスペースと検索条件の同時要求は同じPromiseを共有する", async () => {
    const coordinator = new WorkspaceSearchRequestCoordinator();
    let executeCount = 0;
    let resolveSearch: (value: string) => void = () => {};

    const first = coordinator.run("ws-1", "fullText:needle", async () => {
      executeCount += 1;
      return new Promise<string>((resolve) => {
        resolveSearch = resolve;
      });
    });
    const second = coordinator.run("ws-1", "fullText:needle", async () => "second");

    expect(first).toBe(second);
    expect(executeCount).toBe(1);

    resolveSearch("done");
    await expect(first).resolves.toBe("done");
  });

  it("新しい検索条件が来たら古い検索の継続判定をfalseにする", async () => {
    const coordinator = new WorkspaceSearchRequestCoordinator();
    const contexts: SearchRequestContext[] = [];

    const oldSearch = coordinator.run("ws-1", "fullText:old", async (context) => {
      contexts.push(context);
      return "old";
    });

    await expect(oldSearch).resolves.toBe("old");
    expect(contexts[0]?.shouldContinue()).toBe(true);

    await expect(
      coordinator.run("ws-1", "fullText:new", async (context) => {
        expect(context.shouldContinue()).toBe(true);
        return "new";
      })
    ).resolves.toBe("new");

    expect(contexts[0]?.shouldContinue()).toBe(false);
  });
});
