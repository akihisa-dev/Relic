import { type ReactElement } from "react";

export type DiagramActionIconName =
  | "actualSize"
  | "alignHorizontal"
  | "alignTextBottom"
  | "alignTextLeft"
  | "alignTextRight"
  | "alignTextTop"
  | "alignVertical"
  | "check"
  | "close"
  | "copy"
  | "distributeHorizontal"
  | "distributeVertical"
  | "download"
  | "duplicate"
  | "fit"
  | "paper"
  | "print"
  | "printArea"
  | "redo"
  | "reset"
  | "reverse"
  | "shapes"
  | "textLarge"
  | "textSmall"
  | "trash"
  | "undo"
  | "zoomIn"
  | "zoomOut";

export function DiagramActionIcon({ name }: { name: DiagramActionIconName }): ReactElement {
  const paths: Record<DiagramActionIconName, ReactElement> = {
    actualSize: <><path d="M7 7h10v10H7z" /><path d="M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4" /></>,
    alignHorizontal: <><path d="M4 12h16" /><rect height="4" rx="1" width="6" x="5" y="5" /><rect height="4" rx="1" width="9" x="10" y="15" /></>,
    alignTextBottom: <><path d="M5 19h14" /><path d="M8 15h8M9 11h6M10 7h4" /></>,
    alignTextLeft: <><path d="M5 7h14M5 11h9M5 15h12M5 19h7" /></>,
    alignTextRight: <><path d="M5 7h14M10 11h9M7 15h12M12 19h7" /></>,
    alignTextTop: <><path d="M5 5h14" /><path d="M8 9h8M9 13h6M10 17h4" /></>,
    alignVertical: <><path d="M12 4v16" /><rect height="6" rx="1" width="4" x="5" y="5" /><rect height="9" rx="1" width="4" x="15" y="10" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
    copy: <><rect height="11" rx="2" width="9" x="9" y="7" /><path d="M6 14V5a2 2 0 0 1 2-2h8" /></>,
    distributeHorizontal: <><path d="M4 5v14M20 5v14" /><rect height="6" rx="1" width="4" x="7" y="9" /><rect height="6" rx="1" width="4" x="13" y="9" /></>,
    distributeVertical: <><path d="M5 4h14M5 20h14" /><rect height="4" rx="1" width="6" x="9" y="7" /><rect height="4" rx="1" width="6" x="9" y="13" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    duplicate: <><rect height="9" rx="2" width="9" x="8" y="8" /><path d="M5 13V7a2 2 0 0 1 2-2h6" /><path d="M19 12h-4M17 10v4" /></>,
    fit: <><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" /><path d="M8 8 3 3M16 8l5-5M8 16l-5 5M16 16l5 5" /></>,
    paper: <><rect height="16" rx="1.5" width="12" x="6" y="4" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    print: <><path d="M7 8V4h10v4" /><rect height="8" rx="1.5" width="10" x="7" y="12" /><path d="M6 18H4V9h16v9h-2" /><path d="M8 15h8" /></>,
    printArea: <><rect height="14" rx="1.5" width="18" x="3" y="5" /><path d="M7 9h10v6H7z" /><path d="M7 3v4M17 3v4M7 17v4M17 17v4" /></>,
    redo: <><path d="M20 7v6h-6" /><path d="M20 13a8 8 0 1 1-2.3-5.7" /></>,
    reset: <><path d="M4 4v6h6" /><path d="M20 20v-6h-6" /><path d="M5 10a7 7 0 0 1 11.9-4.9L20 8" /><path d="M19 14a7 7 0 0 1-11.9 4.9L4 16" /></>,
    reverse: <><path d="M7 7h10l-3-3M17 17H7l3 3" /><path d="M17 7 7 17" /></>,
    shapes: <><rect height="7" rx="1.5" width="7" x="4" y="4" /><path d="M16.5 4 21 8.5 16.5 13 12 8.5z" /><circle cx="9" cy="17" r="3" /></>,
    textLarge: <><path d="M4 18 10 6h2l6 12" /><path d="M7 13h8" /></>,
    textSmall: <><path d="M7 18 11 9h2l4 9" /><path d="M9 14h6" /></>,
    trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
    undo: <><path d="M4 7v6h6" /><path d="M4 13a8 8 0 1 0 2.3-5.7" /></>,
    zoomIn: <><circle cx="10" cy="10" r="5" /><path d="M10 7v6M7 10h6M14 14l6 6" /></>,
    zoomOut: <><circle cx="10" cy="10" r="5" /><path d="M7 10h6M14 14l6 6" /></>
  };

  return (
    <svg aria-hidden="true" className="diagram-canvas-action-icon" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width="18">
      {paths[name]}
    </svg>
  );
}
