import { withDiagramRenderTimeout } from "./diagramLimits";

type D2CompileOptions = import("@terrastruct/d2").CompileOptions;
type D2CompileRequest = import("@terrastruct/d2").CompileRequest;
type D2Renderer = InstanceType<(typeof import("@terrastruct/d2"))["D2"]>;

let d2RendererPromise: Promise<D2Renderer> | null = null;
let d2RenderQueue: Promise<void> = Promise.resolve();

export function enqueueD2Render(source: string): Promise<string> {
  const renderOperation = d2RenderQueue.then(() => renderD2Svg(source));
  d2RenderQueue = renderOperation.then(
    () => undefined,
    () => undefined
  );

  return withDiagramRenderTimeout(renderOperation, "d2");
}

async function loadD2(): Promise<D2Renderer> {
  if (!d2RendererPromise) {
    d2RendererPromise = import("@terrastruct/d2").then(({ D2 }) => new D2());
  }

  return d2RendererPromise;
}

async function renderD2Svg(source: string): Promise<string> {
  const d2 = await loadD2();
  const result = await d2.compile(createD2CompileRequest(source));
  const svg = await d2.render(result.diagram, {
    ...(result.renderOptions ?? {}),
    noXMLTag: true
  });

  if (typeof svg !== "string") {
    throw new Error("D2 renderer did not return SVG text.");
  }

  return svg;
}

function createD2CompileRequest(source: string): D2CompileRequest {
  return {
    fs: { index: source },
    options: getD2CompileOptions()
  };
}

function getD2CompileOptions(): D2CompileOptions {
  return { layout: "dagre" };
}
