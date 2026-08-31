import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const entryCss = readFileSync("src/renderer/styles.css", "utf8");
const lazyViews = readFileSync("src/renderer/hooks/appTabLazyViews.tsx", "utf8");

const deferredViews = [
  ["ChartView", "chronicle"],
  ["CardView", "cards"],
  ["BubbleView", "bubble"],
  ["SphereView", "sphere"],
  ["TableView", "table-view"],
  ["FrontmatterPanel", "table-view"],
  ["SettingsPanel", "settings"]
] as const;
const deferredStyles = [...new Set(deferredViews.map(([, style]) => style))];

describe("app tab lazy view styles", () => {
  it("resolves the chronicle view entry together with its stylesheet", async () => {
    const module = await import("./lazyViews/ChartView");
    expect(module.default).toBeTypeOf("function");
  });

  it("keeps feature styles out of the initial style entry", () => {
    for (const style of deferredStyles) {
      expect(entryCss).not.toContain(`./styles/${style}.css`);
    }
  });

  it("loads each deferred stylesheet through the stable feature cascade layer", () => {
    for (const style of deferredStyles) {
      const lazyEntry = readFileSync(`src/renderer/styles/lazy/${style}.css`, "utf8");
      expect(lazyEntry).toBe(`@import "../${style}.css" layer(relic-feature);\n`);
    }
    for (const [view, style] of deferredViews) {
      const viewEntry = readFileSync(`src/renderer/hooks/lazyViews/${view}.ts`, "utf8");
      expect(lazyViews).toContain(`import("./lazyViews/${view}")`);
      expect(viewEntry).toContain(`import "../../styles/lazy/${style}.css";`);
    }
  });

  it("keeps architectural refinements after asynchronously loaded feature rules", () => {
    expect(entryCss).toContain(
      "@layer relic-vendor, relic-foundation, relic-shell, relic-feature, relic-theme, relic-refinements;"
    );
  });
});
