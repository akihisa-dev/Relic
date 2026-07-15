import { render } from "@testing-library/react";

import { defaultFeatureToggles } from "../shared/ipc";
import { App } from "./App";

export function renderApp() {
  return render(<App />);
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

export const allRailFeatureToggles = {
  ...defaultFeatureToggles,
  chronicle: true,
  frontmatter: true,
  tools: true
};
