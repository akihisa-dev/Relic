import { afterEach, describe, expect, it } from "vitest";

import {
  __resetLocalEditorContentEchoesForTests,
  consumeLocalEditorContentEcho,
  markLocalEditorContentEcho
} from "./editorContentEcho";

describe("editorContentEcho", () => {
  afterEach(() => {
    __resetLocalEditorContentEchoesForTests();
  });

  it("同じタブでも発生元が異なるエディタの反映は消費しない", () => {
    markLocalEditorContentEcho("left:tab", "updated");

    expect(consumeLocalEditorContentEcho("right:tab", "updated")).toBe(false);
    expect(consumeLocalEditorContentEcho("left:tab", "updated")).toBe(true);
  });
});
