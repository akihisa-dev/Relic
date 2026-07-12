import { afterEach, describe, expect, it } from "vitest";

import { makeRelicApi } from "../test/rendererTestUtils";
import { installRelicClientProvider, relicClient } from "./relicClient";

let restoreProvider: (() => void) | undefined;

afterEach(() => {
  restoreProvider?.();
  restoreProvider = undefined;
  window.relic = undefined;
});

describe("relicClient", () => {
  it("resolves the current preload API without capturing the initial value", () => {
    expect(relicClient.current).toBeUndefined();

    const api = makeRelicApi();
    window.relic = api;

    expect(relicClient.current).toBe(api);
  });

  it("supports an injectable provider and restores the previous provider", () => {
    const windowApi = makeRelicApi();
    const injectedApi = makeRelicApi();
    window.relic = windowApi;

    restoreProvider = installRelicClientProvider(() => injectedApi);
    expect(relicClient.current).toBe(injectedApi);

    restoreProvider();
    restoreProvider = undefined;
    expect(relicClient.current).toBe(windowApi);
  });
});
