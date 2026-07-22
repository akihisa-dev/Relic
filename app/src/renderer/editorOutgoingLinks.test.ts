import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __getOutgoingLinkFullScansForTests,
  __resetOutgoingLinkFullScansForTests,
  updateOutgoingLinksSnapshot
} from "./editorOutgoingLinks";

describe("editorOutgoingLinks", () => {
  afterEach(() => __resetOutgoingLinkFullScansForTests());

  it("通常文の差分編集ではリンク解析結果を再利用する", () => {
    const resolver = vi.fn(() => []);
    const original = "本文 [[Note]] 末尾";
    const initial = updateOutgoingLinksSnapshot(null, original, 1, undefined, "source.md", resolver, 100);
    const content = `追記${original}`;

    const updated = updateOutgoingLinksSnapshot(initial, content, 2, {
      change: { from: 0, newTo: 2, oldTo: 0 },
      generation: 1,
      previousRevision: 1,
      revision: 2
    }, "source.md", resolver, 100);

    expect(__getOutgoingLinkFullScansForTests()).toBe(1);
    expect(resolver).toHaveBeenCalledOnce();
    expect(updated.matches[0]?.from).toBe(initial.matches[0]!.from + 2);
  });

  it("リンク構文を変更した場合だけ全文を再解析する", () => {
    const resolver = vi.fn(() => []);
    const original = "本文 [[Note]]";
    const initial = updateOutgoingLinksSnapshot(null, original, 1, undefined, "source.md", resolver, 100);
    const from = original.indexOf("Note");
    const content = original.replace("Note", "Other");

    updateOutgoingLinksSnapshot(initial, content, 2, {
      change: { from, newTo: from + 5, oldTo: from + 4 },
      generation: 1,
      previousRevision: 1,
      revision: 2
    }, "source.md", resolver, 100);

    expect(__getOutgoingLinkFullScansForTests()).toBe(2);
    expect(resolver).toHaveBeenCalledTimes(2);
  });
});
