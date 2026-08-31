import { act, render, type RenderResult } from "@testing-library/react";

import { App } from "./App";

export async function renderApp(): Promise<RenderResult> {
  let result: RenderResult | undefined;
  await act(async () => {
    result = render(<App />);
  });
  if (!result) throw new Error("App test render did not complete.");
  return result;
}

export function searchResultSet(results: unknown[]) {
  return { results, skippedLargeFiles: 0, skippedLongLines: 0, truncated: false };
}

const originalNavigatorPlatform = Object.getOwnPropertyDescriptor(navigator, "platform");

export function setNavigatorPlatform(platform: string): void {
  Object.defineProperty(navigator, "platform", {
    configurable: true,
    value: platform
  });
}

export function restoreNavigatorPlatform(): void {
  if (originalNavigatorPlatform) {
    Object.defineProperty(navigator, "platform", originalNavigatorPlatform);
    return;
  }

  Reflect.deleteProperty(navigator, "platform");
}
