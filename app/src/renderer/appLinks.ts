export interface AppLinkContextMenu {
  exists: boolean;
  heading?: string;
  markdownLink: string;
  openKind: "file" | "wiki";
  path: string;
  target?: string;
  x: number;
  y: number;
}

export function markdownLinkForPath(path: string): string {
  return `[[${path.replace(/\.md$/i, "")}]]`;
}
