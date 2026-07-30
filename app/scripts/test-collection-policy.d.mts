export const nodeTestIncludes: string[];
export const rendererTestIncludes: string[];
export function vitestProjectForTestPath(relativePath: string): "node" | "renderer" | null;
