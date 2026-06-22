import { describe, expect, it } from "vitest";

import {
  editorContextMenuPosition,
  frontmatterDialogCandidatesFor
} from "./editorContextMenuModel";

describe("editorContextMenuModel", () => {
  it("clamps context menu position inside the viewport", () => {
    expect(editorContextMenuPosition(-10, -10, { innerHeight: 200, innerWidth: 300 })).toEqual({ x: 8, y: 8 });
    expect(editorContextMenuPosition(400, 400, { innerHeight: 200, innerWidth: 300 })).toEqual({ x: 8, y: 36 });
    expect(editorContextMenuPosition(40, 360, { innerHeight: 400, innerWidth: 500 })).toEqual({ x: 68, y: 80 });
    expect(editorContextMenuPosition(490, 780, { innerHeight: 800, innerWidth: 500 })).toEqual({ x: 152, y: 172 });
  });

  it("returns field candidates for frontmatter dialogs", () => {
    expect(frontmatterDialogCandidatesFor("status", { status: ["custom"] })).toEqual(["custom"]);
    expect(frontmatterDialogCandidatesFor("tags", { tags: ["draft"] })).toEqual(["draft"]);
    expect(frontmatterDialogCandidatesFor("missing", {})).toEqual([]);
  });
});
