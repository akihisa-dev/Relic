import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  defaultWorkspaceTablePreferences,
  type WorkspaceTablePreferences
} from "../../shared/ipc";
import { installRelicClientProvider, type RelicClient } from "../relicClient";
import { useWorkspaceTablePreferences } from "./useWorkspaceTablePreferences";

const restores: Array<() => void> = [];

afterEach(() => {
  restores.splice(0).reverse().forEach((restore) => restore());
});

describe("useWorkspaceTablePreferences", () => {
  it("再読込後は以前の保存失敗を現在の設定へ反映しない", async () => {
    let resolveSave: ((result: {
      error: { code: "WRITE_FAILED"; message: string };
      ok: false;
    }) => void) | undefined;
    restores.push(installRelicClientProvider(() => ({
      saveWorkspaceTablePreferences: vi.fn(() => new Promise((resolve) => {
        resolveSave = resolve;
      }))
    } as unknown as RelicClient)));
    const initialPreferences = preferences({ selectedProperties: ["count"] });
    const refreshedPreferences = preferences({ selectedProperties: ["status"] });
    const pendingPreferences = preferences({ selectedProperties: ["count", "status"] });
    const { result, rerender } = renderHook(
      ({ current }) => useWorkspaceTablePreferences({
        initialPreferences: current,
        saveFailedMessage: "保存できません"
      }),
      { initialProps: { current: initialPreferences } }
    );

    act(() => {
      void result.current.persist(pendingPreferences);
    });
    expect(result.current.preferences).toEqual(pendingPreferences);

    rerender({ current: refreshedPreferences });
    await waitFor(() => expect(result.current.preferences).toEqual(refreshedPreferences));
    await act(async () => {
      resolveSave?.({
        error: { code: "WRITE_FAILED", message: "古い失敗" },
        ok: false
      });
      await Promise.resolve();
    });

    expect(result.current.preferences).toEqual(refreshedPreferences);
    expect(result.current.saveError).toBeNull();
  });
});

function preferences(
  overrides: Partial<WorkspaceTablePreferences>
): WorkspaceTablePreferences {
  return {
    ...defaultWorkspaceTablePreferences,
    ...overrides,
    columnWidths: overrides.columnWidths ?? [],
    filters: overrides.filters ?? [],
    selectedProperties: overrides.selectedProperties ?? [],
    sort: overrides.sort ?? { direction: "asc", property: null },
    wrappedProperties: overrides.wrappedProperties ?? []
  };
}
