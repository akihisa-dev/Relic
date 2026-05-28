type D2CompileOptions = Omit<import("@terrastruct/d2").CompileRequest, "fs">;
type D2Renderer = InstanceType<(typeof import("@terrastruct/d2"))["D2"]>;

let d2RendererPromise: Promise<D2Renderer> | null = null;
let d2RenderQueue: Promise<void> = Promise.resolve();

export function enqueueD2Render(source: string): Promise<string> {
  const renderTask = d2RenderQueue.then(() => renderD2Svg(source));
  d2RenderQueue = renderTask.then(
    () => undefined,
    () => undefined
  );

  return renderTask;
}

async function loadD2(): Promise<D2Renderer> {
  if (!d2RendererPromise) {
    d2RendererPromise = import("@terrastruct/d2").then(({ D2 }) => new D2());
  }

  return d2RendererPromise;
}

async function renderD2Svg(source: string): Promise<string> {
  const d2 = await loadD2();
  const compileOptions = getD2CompileOptions();
  const result = await d2.compile(source, compileOptions);
  const svg = await d2.render(result.diagram, {
    ...(result.renderOptions ?? {}),
    noXMLTag: true
  });

  if (typeof svg !== "string") {
    throw new Error("D2 renderer did not return SVG text.");
  }

  return svg;
}

function getD2CompileOptions(): D2CompileOptions {
  return { layout: "dagre" } as unknown as D2CompileOptions;
}
