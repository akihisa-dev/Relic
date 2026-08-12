import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { useBacklinksState } from "./useBacklinksState";

describe("useBacklinksState", () => {
  afterEach(() => {
    window.relic = undefined;
    vi.clearAllMocks();
  });

  it("IPC transport rejection clears the active file backlinks", async () => {
    const setWorkspaceError = vi.fn();
    window.relic = makeRelicApi({
      getBacklinks: vi.fn().mockRejectedValue(new Error("secret transport detail"))
    });

    const { result } = renderHook(() => useBacklinksState({
      activeFilePath: "note.md",
      enabled: true,
      fileTree: [],
      setWorkspaceError
    }));

    await waitFor(() => expect(result.current.isLoadingBacklinks).toBe(false));

    expect(result.current.backlinks).toEqual([]);
    expect(setWorkspaceError).toHaveBeenCalled();
    expect(setWorkspaceError).not.toHaveBeenCalledWith(expect.stringContaining("secret transport detail"));
  });
});
