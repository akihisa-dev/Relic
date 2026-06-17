import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

import { createTranslator } from "./i18nModel";

type DiagramRenderGate = {
  promise: Promise<void>;
  resolve: () => void;
};

function createDiagramRenderGate(): DiagramRenderGate {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

const renderCalls = vi.hoisted(() => [] as DiagramRenderGate[]);
const inFlightDiagrams = vi.hoisted(() => new Set<DiagramRenderGate>());
const maxInFlightDiagrams = vi.hoisted(() => ({ value: 0 }));
const renderDiagramElement = vi.hoisted(() => vi.fn(async () => {
  const gate = createDiagramRenderGate();
  renderCalls.push(gate);
  inFlightDiagrams.add(gate);
  maxInFlightDiagrams.value = Math.max(maxInFlightDiagrams.value, inFlightDiagrams.size);

  await gate.promise.finally(() => {
    inFlightDiagrams.delete(gate);
  });

  return null;
}));

vi.mock("./diagramPreview", async () => ({
  ...(await vi.importActual<typeof import("./diagramPreview")>("./diagramPreview")),
  renderDiagramElement
}));

import { buildPreviewOutputHtml } from "./outputHtml";

describe("outputHtml", () => {
  afterEach(() => {
    vi.clearAllMocks();
    renderCalls.length = 0;
    inFlightDiagrams.clear();
    maxInFlightDiagrams.value = 0;
  });

  it("PDF/HTML出力の図表レンダリングを同時実行2件へ制限する", async () => {
    const content = [
      "# タイトル",
      "",
      "```mermaid",
      "A --> B",
      "```",
      "",
      "```d2",
      "x -> y: one",
      "```",
      "",
      "```mermaid",
      "B --> C",
      "```",
      "",
      "```d2",
      "y -> z: two",
      "```"
    ].join("\n");

    const htmlPromise = buildPreviewOutputHtml({
      content,
      fileName: "Diagram",
      path: "diagram.md",
      t: createTranslator("ja"),
      title: "Diagram",
      workspacePath: "/tmp/relic"
    });

    await waitFor(() => {
      expect(renderCalls).toHaveLength(2);
    });
    expect(maxInFlightDiagrams.value).toBe(2);

    renderCalls[0].resolve();
    renderCalls[1].resolve();

    await waitFor(() => {
      expect(renderCalls).toHaveLength(4);
    });

    renderCalls[2].resolve();
    renderCalls[3].resolve();

    const result = await htmlPromise;

    expect(result.html).toContain("class=\"preview-diagram");
    expect(result.html).toContain("A --&gt; B");
    expect(result.html).toContain("x -&gt; y: one");

    const firstDiagramIndex = result.html.indexOf("A --&gt; B");
    const secondDiagramIndex = result.html.indexOf("B --&gt; C");
    const thirdDiagramIndex = result.html.indexOf("x -&gt; y: one");
    const fourthDiagramIndex = result.html.indexOf("y -&gt; z: two");

    expect(firstDiagramIndex).toBeGreaterThanOrEqual(0);
    expect(secondDiagramIndex).toBeGreaterThanOrEqual(0);
    expect(thirdDiagramIndex).toBeGreaterThanOrEqual(0);
    expect(fourthDiagramIndex).toBeGreaterThanOrEqual(0);
    expect(firstDiagramIndex).toBeLessThan(thirdDiagramIndex);
    expect(thirdDiagramIndex).toBeLessThan(secondDiagramIndex);
    expect(secondDiagramIndex).toBeLessThan(fourthDiagramIndex);
  });
});
