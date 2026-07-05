import { describe, expect, it, vi } from "vitest";

import { captureEditorScrollAnchor, restoreEditorScrollAnchor } from "./editorScrollAnchor";

describe("editorScrollAnchor", () => {
  it("スクロール上端の文書位置と行内オフセットを記録する", () => {
    const view = {
      lineBlockAtHeight: vi.fn().mockReturnValue({ from: 120, top: 300 }),
      scrollDOM: { scrollTop: 318 },
      state: { doc: { length: 500 } }
    };

    expect(captureEditorScrollAnchor(view as never)).toEqual({
      offset: 18,
      pos: 120
    });
    expect(view.lineBlockAtHeight).toHaveBeenCalledWith(318);
  });

  it("切替後の同じ文書位置へスクロールを戻す", () => {
    const view = {
      lineBlockAt: vi.fn().mockReturnValue({ top: 480 }),
      scrollDOM: { scrollLeft: 0, scrollTop: 0 },
      state: { doc: { length: 500 } }
    };

    restoreEditorScrollAnchor(view as never, { offset: 18, pos: 120 }, 12);

    expect(view.lineBlockAt).toHaveBeenCalledWith(120);
    expect(view.scrollDOM.scrollLeft).toBe(12);
    expect(view.scrollDOM.scrollTop).toBe(498);
  });
});
