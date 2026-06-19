import {
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  addRelicFreeDrawingNode,
  addRelicDiagramLine,
  alignRelicDiagramNodes,
  defaultRelicDiagramPrintSettings,
  distributeRelicDiagramNodes,
  duplicateRelicDiagramNodes,
  relicDiagramNodeColorPresets,
  relicDiagramPaperSizes,
  relicDiagramPrintMarginPresets,
  relicDiagramPrintOrientations,
  relicDiagramPrintScaleModes,
  moveRelicDiagramNode,
  moveRelicDiagramNodesByDelta,
  moveRelicFreeDrawingAreaWithContents,
  relicFreeDrawingShapeTypes,
  removeRelicDiagramLine,
  removeRelicDiagramNode,
  removeRelicDiagramNodes,
  reverseRelicDiagramLineDirection,
  resizeRelicDiagramNode,
  updateRelicDiagramLineAppearance,
  updateRelicFreeDrawingNodeShape,
  updateRelicDiagramNodesAppearance,
  updateRelicDiagramPrintArea,
  updateRelicDiagramPrintSettings,
  updateRelicFreeDrawingNodeText,
  updateRelicDiagramLineEndpoints,
  updateRelicDiagramLineLabel,
  type RelicConnectedDiagramDocument,
  type RelicConnectedDiagramNode,
  type RelicDiagramLine,
  type RelicDiagramNodeBase,
  type RelicDiagramPrintArea,
  type RelicDiagramPrintSettings,
  type RelicDiagramTextSize,
  type RelicFreeDrawingShapeType
} from "../../../shared/diagramMarkdown";
import {
  buildPreviewOutputHtml,
  printOptionsFromDiagramSettings
} from "../../outputHtml";
import {
  diagramLineLabelFontSize,
  diagramNodeAlignItems,
  diagramNodeFontSize,
  diagramNodeJustifyItems,
  diagramNodeTextColor
} from "../../diagramAppearance";
import { editorContextMenuPosition } from "../../editorContextMenuModel";
import { useT } from "../../i18n";
import { type TranslationKey, type Translator } from "../../i18nModel";
import {
  buildDiagramCanvasLayout,
  buildLineLayouts,
  visibleDiagramLines,
  type DiagramCanvasLineLayout
} from "./diagramGeometry";
import {
  clampZoom,
  screenToCanvasPoint,
  type ViewportState
} from "./diagramViewport";
import { type DiagramCanvasProps } from "./diagramTypes";
import { diagramShapeDragType, isFreeDrawingShapeType } from "./diagramShapeDrag";
import { diagramShapePaletteGroups } from "./diagramShapePalette";
import { DiagramLineLayer } from "./DiagramLineLayer";
import { diagramFreeDrawingLabelDisplayLayer, diagramNodeDisplayLayer } from "./diagramLayering";
import { diagramStatusCountLabels } from "./diagramCanvasStatus";
import { DiagramNodeView } from "./DiagramNodeView";
import { DiagramSnapGuides } from "./DiagramSnapGuides";
import { diagramGridSize, snapDiagramNode, snapDiagramPointToGrid, snapDiagramSizeToGrid, type DiagramSnapGuide } from "./diagramSnap";

const connectActivationDistance = 4;
const connectedShapeDefaultHeight = diagramGridSize * 2;
const connectedShapeDefaultWidth = diagramGridSize * 5;
const decisionOptionLabels = ["YES", "NO"] as const;
const minNodeHeight = 64;
const minNodeWidth = 96;

interface DragState {
  currentX: number;
  currentY: number;
  guides: DiagramSnapGuide[];
  nodeId: string;
  originalX: number;
  originalY: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
}

interface ConnectState {
  isActive: boolean;
  currentX: number;
  currentY: number;
  fromNodeId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
}

interface PanState {
  originalPanX: number;
  originalPanY: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
}

interface ResizeState {
  currentHeight: number;
  currentWidth: number;
  nodeId: string;
  originalHeight: number;
  originalWidth: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
}

interface LineRetargetState {
  currentX: number;
  currentY: number;
  endpoint: "from" | "to";
  fixedX: number;
  fixedY: number;
  line: RelicDiagramLine;
  pointerId: number;
}

interface RangeSelectState {
  currentX: number;
  currentY: number;
  pointerId: number;
  startX: number;
  startY: number;
}

interface PrintAreaDragState {
  currentArea: RelicDiagramPrintArea;
  edge: "bottom" | "left" | "move" | "right" | "top";
  originalArea: RelicDiagramPrintArea;
  pointerId: number;
  startClientX: number;
  startClientY: number;
}

type DiagramSelection =
  | { id: string; type: "line" }
  | { id: string; type: "node" };

interface LabelEditState {
  lineId: string;
  value: string;
}

interface NodeTextEditState {
  nodeId: string;
  value: string;
}

interface DiagramShapePaletteAddRequest {
  handled: boolean;
  shape: RelicFreeDrawingShapeType;
}

type DiagramContextMenuState =
  | { type: "line"; lineId: string; x: number; y: number }
  | { type: "node"; nodeId: string; x: number; y: number };

type DiagramToolbarMenu = "paper" | "printArea" | null;

export function DiagramCanvasSurface({
  content,
  diagram,
  fileName,
  onChange,
  onStatusChange,
  toolbar
}: DiagramCanvasProps & { diagram: RelicConnectedDiagramDocument }): ReactElement {
  const t = useT();
  const canvasStatusDescriptionId = useId();
  const isFreeDrawing = diagram.type === "diagram";
  const [connect, setConnect] = useState<ConnectState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [labelEdit, setLabelEdit] = useState<LabelEditState | null>(null);
  const [nodeTextEdit, setNodeTextEdit] = useState<NodeTextEditState | null>(null);
  const [pan, setPan] = useState<PanState | null>(null);
  const [rangeSelect, setRangeSelect] = useState<RangeSelectState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [printAreaDrag, setPrintAreaDrag] = useState<PrintAreaDragState | null>(null);
  const [lineRetarget, setLineRetarget] = useState<LineRetargetState | null>(null);
  const [paletteDropPreview, setPaletteDropPreview] = useState<{ height: number; width: number; x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<DiagramSelection | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<DiagramContextMenuState | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<{ future: string[]; past: string[] }>({ future: [], past: [] });
  const [copiedNodeIds, setCopiedNodeIds] = useState<string[]>([]);
  const [keyboardConnectFromNodeId, setKeyboardConnectFromNodeId] = useState<string | null>(null);
  const [toolbarMenu, setToolbarMenu] = useState<DiagramToolbarMenu>(null);

  const layout = useMemo(() => buildDiagramCanvasLayout(diagram), [diagram]);
  const previousLayoutOriginRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const canvasStyle = {
    "--diagram-canvas-grid-size": `${diagramGridSize * viewport.zoom}px`,
    "--diagram-canvas-grid-x": `${viewport.panX}px`,
    "--diagram-canvas-grid-y": `${viewport.panY}px`
  } as CSSProperties;
  const applyContentChange = useCallback((nextContent: string): void => {
    if (!onChange || nextContent === content) return;

    setHistory((current) => ({
      future: [],
      past: [...current.past.slice(-49), content]
    }));
    onChange(nextContent);
  }, [content, onChange]);
  const showNotice = useCallback((message: string): void => {
    setNotice(message);
  }, []);
  const undoDiagramChange = useCallback((): void => {
    if (!onChange) return;

    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      onChange(previous);
      return {
        future: [content, ...current.future].slice(0, 50),
        past: current.past.slice(0, -1)
      };
    });
  }, [content, onChange]);
  const redoDiagramChange = useCallback((): void => {
    if (!onChange) return;

    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      onChange(next);
      return {
        future: current.future.slice(1),
        past: [...current.past.slice(-49), content]
      };
    });
  }, [content, onChange]);
  const fitViewportToContent = useCallback((): void => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || layout.width <= 0 || layout.height <= 0) return;

    const horizontalPadding = 80;
    const verticalPadding = 80;
    const nextZoom = clampZoom(Math.min(
      (rect.width - horizontalPadding) / layout.width,
      (rect.height - verticalPadding) / layout.height,
      1
    ));
    setViewport({
      panX: (rect.width - layout.width * nextZoom) / 2,
      panY: (rect.height - layout.height * nextZoom) / 2,
      zoom: nextZoom
    });
  }, [layout.height, layout.width]);
  const resetViewport = useCallback((): void => {
    setViewport({ panX: 0, panY: 0, zoom: 1 });
  }, []);
  const zoomViewport = useCallback((factor: number): void => {
    setViewport((current) => ({
      ...current,
      zoom: clampZoom(current.zoom * factor)
    }));
  }, []);

  useEffect(() => {
    setNotice(null);
    setSelectedNodeIds(new Set());
    setSelection(null);
    setHistory({ future: [], past: [] });
    setCopiedNodeIds([]);
    setKeyboardConnectFromNodeId(null);
  }, [fileName]);

  useLayoutEffect(() => {
    const previous = previousLayoutOriginRef.current;
    previousLayoutOriginRef.current = { x: layout.originX, y: layout.originY };
    if (!previous) return;

    const deltaX = layout.originX - previous.x;
    const deltaY = layout.originY - previous.y;
    if (deltaX === 0 && deltaY === 0) return;

    setViewport((current) => ({
      ...current,
      panX: current.panX + deltaX * current.zoom,
      panY: current.panY + deltaY * current.zoom
    }));
  }, [layout.originX, layout.originY]);

  const displayNodes = useMemo(() => {
    const draggedLayoutNode = drag
      ? layout.nodes.find((node) => node.node.id === drag.nodeId)
      : null;
    const draggedArea = draggedLayoutNode && "shape" in draggedLayoutNode.node && draggedLayoutNode.node.shape === "area"
      ? draggedLayoutNode.node
      : null;
    const dragGroupNodeIds = drag && selectedNodeIds.has(drag.nodeId) && selectedNodeIds.size > 1
      ? selectedNodeIds
      : new Set<string>();
    const dragDeltaX = drag ? drag.currentX - drag.originalX : 0;
    const dragDeltaY = drag ? drag.currentY - drag.originalY : 0;

    return layout.nodes.map((node) => {
      if (resize?.nodeId === node.node.id) {
        return {
          node: {
            ...node.node,
            height: resize.currentHeight,
            width: resize.currentWidth
          },
          x: node.x,
          y: node.y
        };
      }
      if (drag?.nodeId === node.node.id) {
        return {
          node: {
            ...node.node,
            x: drag.currentX,
            y: drag.currentY
          },
          x: drag.currentX - layout.originX,
          y: drag.currentY - layout.originY
        };
      }
      if (dragGroupNodeIds.has(node.node.id)) {
        return {
          node: {
            ...node.node,
            x: node.node.x + dragDeltaX,
            y: node.node.y + dragDeltaY
          },
          x: node.x + dragDeltaX,
          y: node.y + dragDeltaY
        };
      }
      if (draggedArea && isNodeFullyInsideNode(node.node, draggedArea)) {
        return {
          node: {
            ...node.node,
            x: node.node.x + dragDeltaX,
            y: node.node.y + dragDeltaY
          },
          x: node.x + dragDeltaX,
          y: node.y + dragDeltaY
        };
      }

      return node;
    });
  }, [drag, layout, resize, selectedNodeIds]);
  const displayLines = useMemo(
    () => buildLineLayouts(visibleDiagramLines(diagram.lines, diagram.nodes), displayNodes),
    [diagram.lines, diagram.nodes, displayNodes]
  );
  const displaySnapGuides = useMemo(() => (drag?.guides ?? []).map((guide) => ({
    ...guide,
    value: guide.value - (guide.axis === "x" ? layout.originX : layout.originY)
  })), [drag?.guides, layout.originX, layout.originY]);
  const freeDrawingShapeGroups = useMemo(() => diagramShapePaletteGroups(t), [t]);
  const dragDropPreview = useMemo(() => {
    if (!drag) return null;
    const movingNode = diagram.nodes.find((node) => node.id === drag.nodeId);
    if (!movingNode) return null;

    const hasMoved = drag.currentX !== drag.originalX || drag.currentY !== drag.originalY;
    if (!hasMoved) return null;

    const snapped = snapDiagramPointToGrid(drag.currentX, drag.currentY, layout.originX, layout.originY);

    return {
      height: movingNode.height,
      x: snapped.x - layout.originX,
      y: snapped.y - layout.originY,
      width: movingNode.width
    };
  }, [diagram.nodes, drag, layout.originX, layout.originY]);
  const resizePreview = resize
    ? layout.nodes.find((node) => node.node.id === resize.nodeId)
    : null;
  const rangeSelectRect = rangeSelect
    ? normalizeSelectionRect(rangeSelect.startX, rangeSelect.startY, rangeSelect.currentX, rangeSelect.currentY)
    : null;
  const previewLine = useMemo(() => {
    if (lineRetarget) {
      const selectedLineLayout = displayLines.find((line) => line.line.id === lineRetarget.line.id);
      return {
        currentX: lineRetarget.currentX,
        currentY: lineRetarget.currentY,
        displayLayer: selectedLineLayout?.displayLayer ?? 0,
        startX: lineRetarget.fixedX,
        startY: lineRetarget.fixedY
      };
    }
    if (!connect?.isActive) return null;
    const fromNode = displayNodes.find((node) => node.node.id === connect.fromNodeId);

    return {
      currentX: connect.currentX,
      currentY: connect.currentY,
      displayLayer: fromNode ? diagramNodeDisplayLayer(fromNode.node, false, false) : 0,
      startX: connect.startX,
      startY: connect.startY
    };
  }, [connect, displayLines, displayNodes, lineRetarget]);
  const startNodeDrag = (node: RelicDiagramNodeBase, event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!onChange) return;

    event.preventDefault();
    if (event.shiftKey) {
      setSelectedNodeIds((current) => {
        const next = new Set(current);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        return next;
      });
    } else if (!selectedNodeIds.has(node.id)) {
      setSelectedNodeIds(new Set([node.id]));
    }
    setSelection({ id: node.id, type: "node" });
    setNodeTextEdit(null);
    setContextMenu(null);
    focusCanvasFrom(event.currentTarget);
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDrag({
      currentX: node.x,
      currentY: node.y,
      guides: [],
      nodeId: node.id,
      originalX: node.x,
      originalY: node.y,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY
    });
  };
  const updateNodeDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pointerId = event.pointerId;
    const clientX = event.clientX;
    const clientY = event.clientY;

    setDrag((current) => {
      if (!current || current.pointerId !== pointerId) return current;
      const nextX = current.originalX + (clientX - current.startClientX) / viewport.zoom;
      const nextY = current.originalY + (clientY - current.startClientY) / viewport.zoom;
      const movingNode = diagram.nodes.find((node) => node.id === current.nodeId);
      if (!movingNode) return current;
      const snapped = snapDiagramNode(current.nodeId, nextX, nextY, movingNode.width, movingNode.height, layout.nodes);

      return {
        ...current,
        currentX: snapped.x,
        currentY: snapped.y,
        guides: snapped.guides
      };
    });
  };
  const finishNodeDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (typeof event.currentTarget.releasePointerCapture === "function") {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const hasMoved = drag.currentX !== drag.originalX || drag.currentY !== drag.originalY;
    const snapped = hasMoved ? snapDiagramPointToGrid(drag.currentX, drag.currentY, layout.originX, layout.originY) : null;
    if (snapped && (snapped.x !== drag.originalX || snapped.y !== drag.originalY)) {
      const movingNode = diagram.nodes.find((node) => node.id === drag.nodeId);
      const selectedMoveIds = selectedNodeIds.has(drag.nodeId) && selectedNodeIds.size > 1 ? selectedNodeIds : null;
      const moved = selectedMoveIds
        ? moveRelicDiagramNodesByDelta(content, selectedMoveIds, snapped.x - drag.originalX, snapped.y - drag.originalY)
        : movingNode && "shape" in movingNode && movingNode.shape === "area"
        ? moveRelicFreeDrawingAreaWithContents(content, drag.nodeId, snapped.x, snapped.y)
        : moveRelicDiagramNode(content, drag.nodeId, snapped.x, snapped.y);
      if (moved.ok) {
        applyContentChange(moved.value.content);
      }
    }
    setDrag(null);
  };
  const cancelNodeDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDrag(null);
  };
  const startNodeResize = (node: RelicDiagramNodeBase, event: ReactPointerEvent<HTMLElement>): void => {
    if (!onChange) return;

    event.preventDefault();
    event.stopPropagation();
    setSelection({ id: node.id, type: "node" });
    setNodeTextEdit(null);
    setContextMenu(null);
    setKeyboardConnectFromNodeId(null);
    focusCanvasFrom(event.currentTarget);
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setResize({
      currentHeight: node.height,
      currentWidth: node.width,
      nodeId: node.id,
      originalHeight: node.height,
      originalWidth: node.width,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY
    });
  };
  const updateNodeResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pointerId = event.pointerId;
    const clientX = event.clientX;
    const clientY = event.clientY;

    setResize((current) => {
      if (!current || current.pointerId !== pointerId) return current;
      const snapped = snapDiagramSizeToGrid(
        current.originalWidth + (clientX - current.startClientX) / viewport.zoom,
        current.originalHeight + (clientY - current.startClientY) / viewport.zoom,
        minNodeWidth,
        minNodeHeight
      );

      return {
        ...current,
        currentHeight: snapped.height,
        currentWidth: snapped.width
      };
    });
  };
  const finishNodeResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!resize || resize.pointerId !== event.pointerId) return;

    if (typeof event.currentTarget.releasePointerCapture === "function") {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (resize.currentWidth !== resize.originalWidth || resize.currentHeight !== resize.originalHeight) {
      const resized = resizeRelicDiagramNode(content, resize.nodeId, resize.currentWidth, resize.currentHeight);
      if (resized.ok) {
        applyContentChange(resized.value.content);
      }
    }
    setResize(null);
  };
  const cancelNodeResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!resize || resize.pointerId !== event.pointerId) return;
    setResize(null);
  };
  const pointerPositionInCanvas = (event: ReactPointerEvent<HTMLElement>): { x: number; y: number } => {
    const canvas = event.currentTarget.closest(".diagram-canvas") ?? event.currentTarget;
    const rect = canvas.getBoundingClientRect();

    return screenToCanvasPoint(event.clientX, event.clientY, rect, viewport);
  };
  const startPanOnBlank = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!isBlankCanvasTarget(event.target, event.currentTarget)) return;

    event.preventDefault();
    if (contextMenu) {
      setContextMenu(null);
      focusCanvasFrom(event.currentTarget);
      return;
    }
    setSelection(null);
    setSelectedNodeIds(new Set());
    setLabelEdit(null);
    setNodeTextEdit(null);
    setContextMenu(null);
    setKeyboardConnectFromNodeId(null);
    focusCanvasFrom(event.currentTarget);
    if (event.shiftKey) {
      const pointer = pointerPositionInCanvas(event);
      if (typeof event.currentTarget.setPointerCapture === "function") {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      setRangeSelect({
        currentX: pointer.x + layout.originX,
        currentY: pointer.y + layout.originY,
        pointerId: event.pointerId,
        startX: pointer.x + layout.originX,
        startY: pointer.y + layout.originY
      });
      return;
    }
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setPan({
      originalPanX: viewport.panX,
      originalPanY: viewport.panY,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY
    });
  };
  const updatePan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!pan || pan.pointerId !== event.pointerId) return;
    const clientX = event.clientX;
    const clientY = event.clientY;

    setViewport((current) => ({
      ...current,
      panX: pan.originalPanX + clientX - pan.startClientX,
      panY: pan.originalPanY + clientY - pan.startClientY
    }));
  };
  const updateRangeSelect = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!rangeSelect || rangeSelect.pointerId !== event.pointerId) return;
    const pointer = pointerPositionInCanvas(event);

    setRangeSelect((current) => current ? {
      ...current,
      currentX: pointer.x + layout.originX,
      currentY: pointer.y + layout.originY
    } : current);
  };
  const finishPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!pan || pan.pointerId !== event.pointerId) return;

    if (typeof event.currentTarget.releasePointerCapture === "function") {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPan(null);
  };
  const finishRangeSelect = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!rangeSelect || rangeSelect.pointerId !== event.pointerId) return;

    if (typeof event.currentTarget.releasePointerCapture === "function") {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const rect = normalizeSelectionRect(rangeSelect.startX, rangeSelect.startY, rangeSelect.currentX, rangeSelect.currentY);
    const nodeIds = diagram.nodes
      .filter((node) => rectanglesOverlap(rect.x, rect.y, rect.width, rect.height, node.x, node.y, node.width, node.height))
      .map((node) => node.id);
    setSelectedNodeIds(new Set(nodeIds));
    setSelection(nodeIds[0] ? { id: nodeIds[0], type: "node" } : null);
    setRangeSelect(null);
  };
  const handleCanvasWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const clientX = event.clientX;
    const clientY = event.clientY;
    const deltaY = event.deltaY;

    setViewport((current) => {
      const nextZoom = clampZoom(current.zoom * (deltaY < 0 ? 1.1 : 0.9));
      const pointer = screenToCanvasPoint(clientX, clientY, rect, current);

      return {
        panX: clientX - rect.left - pointer.x * nextZoom,
        panY: clientY - rect.top - pointer.y * nextZoom,
        zoom: nextZoom
      };
    });
  };
  const startConnect = (node: RelicDiagramNodeBase, event: ReactPointerEvent<HTMLElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!onChange) return;

    const pointer = pointerPositionInCanvas(event);

    focusCanvasFrom(event.currentTarget);
    setContextMenu(null);
    setKeyboardConnectFromNodeId(null);
    setConnect({
      isActive: false,
      currentX: pointer.x,
      currentY: pointer.y,
      fromNodeId: node.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: pointer.x,
      startY: pointer.y
    });
  };
  const updateConnect = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pointerId = event.pointerId;
    const clientX = event.clientX;
    const clientY = event.clientY;
    const pointer = pointerPositionInCanvas(event);

    setConnect((current) => {
      if (!current || current.pointerId !== pointerId) return current;
      const hasMovedEnough = Math.hypot(
        clientX - current.startClientX,
        clientY - current.startClientY
      ) >= connectActivationDistance;

      return {
        ...current,
        isActive: current.isActive || hasMovedEnough,
        currentX: pointer.x,
        currentY: pointer.y
      };
    });
  };
  const startLineRetarget = (
    line: DiagramCanvasLineLayout,
    endpoint: "from" | "to",
    event: ReactPointerEvent<HTMLButtonElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!onChange) return;

    const pointer = pointerPositionInCanvas(event);
    focusCanvasFrom(event.currentTarget);
    setSelection({ id: line.line.id, type: "line" });
    setSelectedNodeIds(new Set());
    setLabelEdit(null);
    setNodeTextEdit(null);
    setContextMenu(null);
    setKeyboardConnectFromNodeId(null);
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setLineRetarget({
      currentX: pointer.x,
      currentY: pointer.y,
      endpoint,
      fixedX: endpoint === "from" ? line.x2 : line.x1,
      fixedY: endpoint === "from" ? line.y2 : line.y1,
      line: line.line,
      pointerId: event.pointerId
    });
  };
  const updateLineRetarget = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!lineRetarget || lineRetarget.pointerId !== event.pointerId) return;
    const pointer = pointerPositionInCanvas(event);

    setLineRetarget((current) => current ? {
      ...current,
      currentX: pointer.x,
      currentY: pointer.y
    } : current);
  };
  const finishConnect = (toNodeId: string, event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!connect || connect.pointerId !== event.pointerId) return;
    if (!connect.isActive) {
      setConnect(null);
      return;
    }
    if (connect.fromNodeId === toNodeId) {
      showNotice(t("diagram.rejectSelfConnection"));
      setConnect(null);
      return;
    }

    const sourceNode = diagram.nodes.find((node) => node.id === connect.fromNodeId);
    const targetNode = diagram.nodes.find((node) => node.id === toNodeId);
    if (!sourceNode || !targetNode) {
      setConnect(null);
      return;
    }
    if (!canAddDecisionOutputLine(sourceNode, diagram.lines, diagram.nodes)) {
      showNotice(t("diagram.rejectDecisionOutputLimit"));
      setConnect(null);
      return;
    }

    const added = addRelicDiagramLine(
      content,
      connect.fromNodeId,
      toNodeId,
      decisionLineLabel(sourceNode, diagram.lines, diagram.nodes)
    );
    if (added.ok) {
      applyContentChange(added.value.content);
      setSelection({ id: added.value.line.id, type: "line" });
      setLabelEdit({ lineId: added.value.line.id, value: added.value.line.label });
      setContextMenu(null);
    } else {
      showNotice(added.error.message);
    }
    setConnect(null);
  };
  const finishLineRetarget = (nodeId: string, event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!lineRetarget || lineRetarget.pointerId !== event.pointerId) return;

    const nextFrom = lineRetarget.endpoint === "from" ? nodeId : lineRetarget.line.from;
    const nextTo = lineRetarget.endpoint === "to" ? nodeId : lineRetarget.line.to;
    const updated = updateRelicDiagramLineEndpoints(content, lineRetarget.line.id, nextFrom, nextTo);
    if (updated.ok) {
      applyContentChange(updated.value.content);
      setSelection({ id: updated.value.line.id, type: "line" });
      setSelectedNodeIds(new Set());
      setLabelEdit(null);
      setContextMenu(null);
    } else {
      showNotice(updated.error.message);
    }
    setLineRetarget(null);
  };
  const cancelConnect = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!connect || connect.pointerId !== event.pointerId) return;
    setConnect(null);
  };
  const cancelLineRetarget = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!lineRetarget || lineRetarget.pointerId !== event.pointerId) return;
    setLineRetarget(null);
  };
  const startNodePointer = (node: RelicDiagramNodeBase, event: ReactPointerEvent<HTMLDivElement>): void => {
    startNodeDrag(node, event);
  };
  const focusNode = (node: RelicConnectedDiagramNode): void => {
    setSelection({ id: node.id, type: "node" });
    setSelectedNodeIds(new Set([node.id]));
    setContextMenu(null);
  };
  const startNodeOutlineConnect = (node: RelicDiagramNodeBase, event: ReactPointerEvent<HTMLElement>): void => {
    startConnect(node, event);
  };
  const finishNodePointer = (node: RelicDiagramNodeBase, event: ReactPointerEvent<HTMLDivElement>): void => {
    event.stopPropagation();
    if (resize?.pointerId === event.pointerId) {
      finishNodeResize(event);
      return;
    }
    if (connect?.pointerId === event.pointerId) {
      finishConnect(node.id, event);
      return;
    }
    if (lineRetarget?.pointerId === event.pointerId) {
      finishLineRetarget(node.id, event);
      return;
    }

    finishNodeDrag(event);
  };
  const selectLine = (lineId: string, event: ReactPointerEvent<SVGPathElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setSelection({ id: lineId, type: "line" });
    setSelectedNodeIds(new Set());
    setContextMenu(null);
    focusCanvasFrom(event.currentTarget);
  };
  const beginLabelEdit = (line: DiagramCanvasLineLayout): void => {
    if (!onChange) return;

    setSelection({ id: line.line.id, type: "line" });
    setSelectedNodeIds(new Set());
    setNodeTextEdit(null);
    setContextMenu(null);
    setLabelEdit({
      lineId: line.line.id,
      value: line.line.label
    });
  };
  const startLabelEditFromButton = (
    line: DiagramCanvasLineLayout,
    event: ReactPointerEvent<HTMLButtonElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    beginLabelEdit(line);
  };
  const startLabelEditFromLine = (
    line: DiagramCanvasLineLayout,
    event: ReactMouseEvent<SVGPathElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    beginLabelEdit(line);
    focusCanvasFrom(event.currentTarget);
  };
  const changeLabelEditValue = (value: string): void => {
    setLabelEdit((current) => current ? { ...current, value } : current);
  };
  const commitLabelEdit = (): void => {
    if (!labelEdit || !onChange) return;

    const updated = updateRelicDiagramLineLabel(content, labelEdit.lineId, labelEdit.value);
    if (updated.ok) {
      applyContentChange(updated.value.content);
      setSelection({ id: updated.value.line.id, type: "line" });
    }
    setLabelEdit(null);
  };
  const submitLabelEdit = (event: ReactFormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    commitLabelEdit();
  };
  const cancelLabelEdit = (): void => {
    setLabelEdit(null);
  };
  const clearSelectionOnBlankPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (isBlankCanvasTarget(event.target, event.currentTarget)) {
      if (contextMenu) {
        setContextMenu(null);
        focusCanvasFrom(event.currentTarget);
        return;
      }
      setSelection(null);
      setSelectedNodeIds(new Set());
      setLabelEdit(null);
      setNodeTextEdit(null);
      setContextMenu(null);
      focusCanvasFrom(event.currentTarget);
    }
  };
  const deleteSelection = (): void => {
    if (!selection || !onChange) return;

    const deleted = selection.type === "node" && selectedNodeIds.size > 1
      ? removeRelicDiagramNodes(content, selectedNodeIds)
      : selection.type === "node"
      ? removeRelicDiagramNode(content, selection.id)
      : removeRelicDiagramLine(content, selection.id);

    if (deleted.ok) {
      applyContentChange(deleted.value.content);
      setLabelEdit(null);
      setNodeTextEdit(null);
      setSelection(null);
      setSelectedNodeIds(new Set());
      setContextMenu(null);
    }
  };
  const addFreeDrawingNode = (
    shape: RelicFreeDrawingShapeType,
    x?: number,
    y?: number
  ): void => {
    if (!onChange) return;

    const added = addRelicFreeDrawingNode(content, shape, x, y);
    if (added.ok) {
      applyContentChange(added.value.content);
      setSelection({ id: added.value.node.id, type: "node" });
      setSelectedNodeIds(new Set([added.value.node.id]));
      setContextMenu(null);
    }
  };
  const visibleCanvasCenterPosition = (shape: RelicFreeDrawingShapeType): { x: number; y: number } | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const size = connectedFreeDrawingShapeSize(shape);
    const center = screenToCanvasPoint(rect.width / 2, rect.height / 2, rect, viewport);

    return freeDrawingShapeOpenPosition(
      shape,
      center.x + layout.originX - size.width / 2,
      center.y + layout.originY - size.height / 2,
      diagram.nodes,
      layout.originX,
      layout.originY
    );
  };
  const addFreeDrawingNodeAtVisibleCenter = (shape: RelicFreeDrawingShapeType): void => {
    const position = visibleCanvasCenterPosition(shape);
    addFreeDrawingNode(shape, position?.x, position?.y);
  };
  useEffect(() => {
    const addRequestedShape = (event: Event): void => {
      const detail = (event as CustomEvent<DiagramShapePaletteAddRequest>).detail;
      if (!detail || detail.handled || !isFreeDrawingShapeType(detail.shape)) return;

      detail.handled = true;
      addFreeDrawingNodeAtVisibleCenter(detail.shape);
    };

    window.addEventListener("relic-diagram-shape-add", addRequestedShape);
    return () => window.removeEventListener("relic-diagram-shape-add", addRequestedShape);
  });
  const handleCanvasDragOver = (event: ReactDragEvent<HTMLDivElement>): void => {
    if (!isFreeDrawing) return;

    const shape = event.dataTransfer.getData(diagramShapeDragType) || event.dataTransfer.getData("text/plain");
    if (isFreeDrawingShapeType(shape)) {
      const rect = event.currentTarget.getBoundingClientRect();
      const pointer = screenToCanvasPoint(event.clientX, event.clientY, rect, viewport);
      const size = connectedFreeDrawingShapeSize(shape);
      const position = freeDrawingShapeOpenPosition(
        shape,
        pointer.x + layout.originX - size.width / 2,
        pointer.y + layout.originY - size.height / 2,
        diagram.nodes,
        layout.originX,
        layout.originY
      );

      setPaletteDropPreview({
        height: size.height,
        width: size.width,
        x: position.x - layout.originX,
        y: position.y - layout.originY
      });
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const handleCanvasDragLeave = (event: ReactDragEvent<HTMLDivElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;

    setPaletteDropPreview(null);
  };
  const handleCanvasDrop = (event: ReactDragEvent<HTMLDivElement>): void => {
    if (!isFreeDrawing) return;

    const shape = event.dataTransfer.getData(diagramShapeDragType) || event.dataTransfer.getData("text/plain");
    if (!isFreeDrawingShapeType(shape)) return;

    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointer = screenToCanvasPoint(event.clientX, event.clientY, rect, viewport);
    const size = connectedFreeDrawingShapeSize(shape);
    const snapped = freeDrawingShapeOpenPosition(
      shape,
      pointer.x + layout.originX - size.width / 2,
      pointer.y + layout.originY - size.height / 2,
      diagram.nodes,
      layout.originX,
      layout.originY
    );
    setPaletteDropPreview(null);
    addFreeDrawingNode(shape, snapped.x, snapped.y);
  };
  const beginFreeDrawingNodeTextEdit = (
    node: RelicConnectedDiagramNode,
    event: ReactMouseEvent<HTMLDivElement>
  ): void => {
    if (!isFreeDrawing || !("text" in node)) return;

    event.preventDefault();
    event.stopPropagation();
    setSelection({ id: node.id, type: "node" });
    setNodeTextEdit({ nodeId: node.id, value: node.text });
    setLabelEdit(null);
    setContextMenu(null);
  };
  const changeFreeDrawingNodeText = (nodeId: string, value: string): void => {
    setNodeTextEdit((current) => current?.nodeId === nodeId ? { ...current, value } : current);
  };
  const commitFreeDrawingNodeText = (): void => {
    if (!nodeTextEdit || !onChange || !isFreeDrawing) return;

    const updated = updateRelicFreeDrawingNodeText(content, nodeTextEdit.nodeId, nodeTextEdit.value);
    if (updated.ok) {
      applyContentChange(updated.value.content);
      setSelection({ id: updated.value.node.id, type: "node" });
    }
    setNodeTextEdit(null);
  };
  const cancelFreeDrawingNodeText = (): void => {
    setNodeTextEdit(null);
  };
  const reverseSelectedLineDirection = (
    line: DiagramCanvasLineLayout,
    event: ReactPointerEvent<HTMLButtonElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!onChange) return;

    const reversed = reverseRelicDiagramLineDirection(content, line.line.id);
    if (reversed.ok) {
      applyContentChange(reversed.value.content);
      setSelection({ id: reversed.value.line.id, type: "line" });
      setLabelEdit(null);
      setContextMenu(null);
    } else {
      showNotice(reversed.error.message);
    }
  };
  const openNodeContextMenu = (node: RelicConnectedDiagramNode, event: ReactMouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const position = editorContextMenuPosition(event.clientX, event.clientY);
    if (!selectedNodeIds.has(node.id)) {
      setSelectedNodeIds(new Set([node.id]));
    }
    setSelection({ id: node.id, type: "node" });
    setLabelEdit(null);
    setNodeTextEdit(null);
    setContextMenu({ type: "node", nodeId: node.id, ...position });
  };
  const openLineContextMenu = (line: DiagramCanvasLineLayout, event: ReactMouseEvent<SVGPathElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const position = editorContextMenuPosition(event.clientX, event.clientY);
    setSelection({ id: line.line.id, type: "line" });
    setSelectedNodeIds(new Set());
    setLabelEdit(null);
    setNodeTextEdit(null);
    setContextMenu({ type: "line", lineId: line.line.id, ...position });
  };
  const selectedEditableNode = selection?.type === "node"
    ? diagram.nodes.find((node) => node.id === selection.id) ?? null
    : null;
  const selectedLineLayout = selection?.type === "line"
    ? displayLines.find((line) => line.line.id === selection.id)
    : null;
  const selectedNodeIdList = selectedNodeIds.size > 0
    ? [...selectedNodeIds]
    : selection?.type === "node"
    ? [selection.id]
    : [];
  const openKeyboardContextMenu = (): void => {
    if (selectedNodeLayouts.length > 0) {
      const left = Math.min(...selectedNodeLayouts.map((node) => node.x));
      const top = Math.min(...selectedNodeLayouts.map((node) => node.y));
      const position = editorContextMenuPosition(
        viewport.panX + left * viewport.zoom,
        viewport.panY + top * viewport.zoom
      );
      setContextMenu({ type: "node", nodeId: selectedNodeIdList[0], ...position });
      return;
    }
    if (selectedLineLayout) {
      const position = editorContextMenuPosition(
        viewport.panX + ((selectedLineLayout.x1 + selectedLineLayout.x2) / 2) * viewport.zoom,
        viewport.panY + ((selectedLineLayout.y1 + selectedLineLayout.y2) / 2) * viewport.zoom
      );
      setContextMenu({ type: "line", lineId: selectedLineLayout.line.id, ...position });
    }
  };
  const duplicateSelection = (): void => {
    duplicateNodesByIds(selectedNodeIdList);
  };
  const duplicateNodesByIds = (nodeIds: string[]): void => {
    if (!onChange || nodeIds.length === 0) return;

    const duplicated = duplicateRelicDiagramNodes(content, nodeIds);
    if (duplicated.ok) {
      applyContentChange(duplicated.value.content);
      setSelectedNodeIds(new Set(duplicated.value.nodeIds));
      setSelection({ id: duplicated.value.nodeIds[0], type: "node" });
    } else {
      showNotice(duplicated.error.message);
    }
  };
  const copySelection = (): void => {
    if (selectedNodeIdList.length === 0) return;

    setCopiedNodeIds(selectedNodeIdList);
  };
  const pasteCopiedSelection = (): void => {
    duplicateNodesByIds(copiedNodeIds);
  };
  const moveSelectionByKeyboard = (deltaX: number, deltaY: number): void => {
    if (!onChange || selectedNodeIdList.length === 0) return;

    const moved = moveRelicDiagramNodesByDelta(content, selectedNodeIdList, deltaX, deltaY);
    if (moved.ok) {
      applyContentChange(moved.value.content);
      setSelectedNodeIds(new Set(moved.value.nodeIds));
      setSelection({ id: moved.value.nodeIds[0], type: "node" });
    } else {
      showNotice(moved.error.message);
    }
  };
  const alignSelection = (direction: "horizontal" | "vertical"): void => {
    if (!onChange || selectedNodeIdList.length === 0) return;

    const aligned = alignRelicDiagramNodes(content, selectedNodeIdList, direction);
    if (aligned.ok) {
      applyContentChange(aligned.value.content);
      setSelectedNodeIds(new Set(aligned.value.nodeIds));
      setSelection({ id: aligned.value.nodeIds[0], type: "node" });
    } else {
      showNotice(aligned.error.message);
    }
  };
  const distributeSelection = (direction: "horizontal" | "vertical"): void => {
    if (!onChange || selectedNodeIdList.length === 0) return;

    const distributed = distributeRelicDiagramNodes(content, selectedNodeIdList, direction);
    if (distributed.ok) {
      applyContentChange(distributed.value.content);
      setSelectedNodeIds(new Set(distributed.value.nodeIds));
      setSelection({ id: distributed.value.nodeIds[0], type: "node" });
    } else {
      showNotice(distributed.error.message);
    }
  };
  const changeSelectedNodesAppearance = (appearance: Parameters<typeof updateRelicDiagramNodesAppearance>[2]): void => {
    if (!onChange || selectedNodeIdList.length === 0) return;

    const updated = updateRelicDiagramNodesAppearance(content, selectedNodeIdList, appearance);
    if (updated.ok) {
      applyContentChange(updated.value.content);
      setSelectedNodeIds(new Set(updated.value.nodeIds));
      setSelection({ id: updated.value.nodeIds[0], type: "node" });
    } else {
      showNotice(updated.error.message);
    }
  };
  const changeSelectedLineLabelSize = (labelTextSize: RelicDiagramTextSize | null): void => {
    if (!onChange || !selectedLineLayout) return;

    const updated = updateRelicDiagramLineAppearance(content, selectedLineLayout.line.id, { labelTextSize });
    if (updated.ok) {
      applyContentChange(updated.value.content);
      setSelection({ id: updated.value.line.id, type: "line" });
    } else {
      showNotice(updated.error.message);
    }
  };
  const changeSelectedNodeShape = (shape: RelicFreeDrawingShapeType): void => {
    if (!onChange || !selectedEditableNode) return;

    const updated = updateRelicFreeDrawingNodeShape(content, selectedEditableNode.id, shape);
    if (updated.ok) {
      applyContentChange(updated.value.content);
      setSelection({ id: updated.value.node.id, type: "node" });
      setSelectedNodeIds(new Set([updated.value.node.id]));
    } else {
      showNotice(updated.error.message);
    }
  };
  const effectivePrintSettings = diagram.printSettings ?? defaultRelicDiagramPrintSettings;
  const effectivePrintArea = diagram.printArea ?? {
    height: layout.height,
    width: layout.width,
    x: layout.originX,
    y: layout.originY
  };
  const updatePrintArea = (printArea: RelicDiagramPrintArea | null): void => {
    if (!onChange) return;

    const updated = updateRelicDiagramPrintArea(content, printArea);
    if (updated.ok) {
      applyContentChange(updated.value.content);
    } else {
      showNotice(updated.error.message);
    }
  };
  const fitPrintAreaToDiagram = (): void => {
    updatePrintArea({
      height: layout.height,
      width: layout.width,
      x: layout.originX,
      y: layout.originY
    });
  };
  const updatePrintSettings = (nextSettings: RelicDiagramPrintSettings): void => {
    if (!onChange) return;

    const updated = updateRelicDiagramPrintSettings(content, nextSettings);
    if (updated.ok) {
      applyContentChange(updated.value.content);
    } else {
      showNotice(updated.error.message);
    }
  };
  const openDiagramPrintPreview = (): void => {
    if (!window.relic) return;

    void buildPreviewOutputHtml({
      content,
      fileName,
      t,
      title: fileName
    }).then(async (payload) => {
      const result = await window.relic!.printPreview({
        html: payload.html,
        printOptions: printOptionsFromDiagramSettings(effectivePrintSettings),
        title: payload.title
      });
      if (!result.ok) {
        showNotice(result.error.message);
        return;
      }
      showNotice(t("output.printed"));
    }).catch((error) => {
      showNotice(error instanceof Error ? error.message : String(error));
    });
  };
  const startPrintAreaDrag = (
    edge: PrintAreaDragState["edge"],
    event: ReactPointerEvent<HTMLElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPrintAreaDrag({
      currentArea: effectivePrintArea,
      edge,
      originalArea: effectivePrintArea,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY
    });
  };
  const updatePrintAreaDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!printAreaDrag || event.pointerId !== printAreaDrag.pointerId) return;

    const deltaX = (event.clientX - printAreaDrag.startClientX) / viewport.zoom;
    const deltaY = (event.clientY - printAreaDrag.startClientY) / viewport.zoom;
    const area = printAreaDrag.originalArea;
    const minSize = diagramGridSize * 2;
    const nextArea = printAreaDrag.edge === "move"
      ? {
          ...area,
          x: Math.round(area.x + deltaX),
          y: Math.round(area.y + deltaY)
        }
      : {
          height: Math.round(Math.max(minSize, area.height + (printAreaDrag.edge === "bottom" ? deltaY : printAreaDrag.edge === "top" ? -deltaY : 0))),
          width: Math.round(Math.max(minSize, area.width + (printAreaDrag.edge === "right" ? deltaX : printAreaDrag.edge === "left" ? -deltaX : 0))),
          x: Math.round(printAreaDrag.edge === "left" ? area.x + Math.min(deltaX, area.width - minSize) : area.x),
          y: Math.round(printAreaDrag.edge === "top" ? area.y + Math.min(deltaY, area.height - minSize) : area.y)
        };
    setPrintAreaDrag((current) => current ? { ...current, currentArea: nextArea } : current);
  };
  const finishPrintAreaDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!printAreaDrag || event.pointerId !== printAreaDrag.pointerId) return;
    updatePrintArea(printAreaDrag.currentArea);
    setPrintAreaDrag(null);
  };
  const lineRetargetNodeState = (nodeId: string): "available" | "blocked" | undefined => {
    if (!lineRetarget) return undefined;

    const nextFrom = lineRetarget.endpoint === "from" ? nodeId : lineRetarget.line.from;
    const nextTo = lineRetarget.endpoint === "to" ? nodeId : lineRetarget.line.to;
    const updated = updateRelicDiagramLineEndpoints(content, lineRetarget.line.id, nextFrom, nextTo);
    return updated.ok ? "available" : "blocked";
  };
  const connectSelectedNodeByKeyboard = (): void => {
    if (!onChange || !selectedEditableNode) return;
    if (!keyboardConnectFromNodeId) {
      setKeyboardConnectFromNodeId(selectedEditableNode.id);
      showNotice(t("diagram.keyboardConnectStarted"));
      return;
    }
    if (keyboardConnectFromNodeId === selectedEditableNode.id) {
      showNotice(t("diagram.rejectSelfConnection"));
      return;
    }

    const sourceNode = diagram.nodes.find((node) => node.id === keyboardConnectFromNodeId);
    if (!sourceNode) {
      setKeyboardConnectFromNodeId(selectedEditableNode.id);
      showNotice(t("diagram.keyboardConnectStarted"));
      return;
    }
    if (!canAddDecisionOutputLine(sourceNode, diagram.lines, diagram.nodes)) {
      showNotice(t("diagram.rejectDecisionOutputLimit"));
      setKeyboardConnectFromNodeId(null);
      return;
    }

    const added = addRelicDiagramLine(
      content,
      sourceNode.id,
      selectedEditableNode.id,
      decisionLineLabel(sourceNode, diagram.lines, diagram.nodes)
    );
    if (added.ok) {
      applyContentChange(added.value.content);
      setKeyboardConnectFromNodeId(null);
      setSelectedNodeIds(new Set());
      setSelection({ id: added.value.line.id, type: "line" });
      setLabelEdit({ lineId: added.value.line.id, value: added.value.line.label });
    } else {
      showNotice(added.error.message);
      setKeyboardConnectFromNodeId(null);
    }
  };
  const handleCanvasKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const isMod = event.metaKey || event.ctrlKey;
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      openKeyboardContextMenu();
      return;
    }
    if (isMod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        redoDiagramChange();
      } else {
        undoDiagramChange();
      }
      return;
    }
    if (isMod && event.key.toLowerCase() === "d") {
      event.preventDefault();
      duplicateSelection();
      return;
    }
    if (isMod && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copySelection();
      return;
    }
    if (isMod && event.key.toLowerCase() === "v") {
      event.preventDefault();
      pasteCopiedSelection();
      return;
    }
    if (["+", "="].includes(event.key)) {
      event.preventDefault();
      zoomViewport(1.1);
      return;
    }
    if (event.key === "-") {
      event.preventDefault();
      zoomViewport(0.9);
      return;
    }
    if (event.key === "0") {
      event.preventDefault();
      resetViewport();
      return;
    }
    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      fitViewportToContent();
      return;
    }
    if (event.key.toLowerCase() === "l") {
      event.preventDefault();
      connectSelectedNodeByKeyboard();
      return;
    }
    if (event.key === "Enter" || event.key === "F2") {
      if (selectedEditableNode) {
        event.preventDefault();
        setNodeTextEdit({ nodeId: selectedEditableNode.id, value: selectedEditableNode.text });
      }
      return;
    }
    if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      const step = event.shiftKey ? diagramGridSize : 1;
      if (selectedNodeIdList.length > 0) {
        const delta = arrowDelta(event.key, step);
        moveSelectionByKeyboard(delta.x, delta.y);
      } else {
        const delta = arrowDelta(event.key, step * 8);
        setViewport((current) => ({
          ...current,
          panX: current.panX - delta.x,
          panY: current.panY - delta.y
        }));
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (contextMenu) {
        setContextMenu(null);
        return;
      }
      setConnect(null);
      setDrag(null);
      setLabelEdit(null);
      setLineRetarget(null);
      setNodeTextEdit(null);
      setPan(null);
      setRangeSelect(null);
      setResize(null);
      setSelection(null);
      setSelectedNodeIds(new Set());
      setContextMenu(null);
      setKeyboardConnectFromNodeId(null);
      return;
    }
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (!selection) return;

    event.preventDefault();
    deleteSelection();
  };
  const selectedNodeLayouts = selectedNodeIdList
    .map((nodeId) => displayNodes.find((node) => node.node.id === nodeId))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));
  const statusCounts = useMemo(
    () => diagramStatusCountLabels(diagram.nodes.length, diagram.lines.length, t),
    [diagram.lines.length, diagram.nodes.length, t]
  );
  const diagramStatusText = useMemo(() => {
    if (nodeTextEdit) return t("diagram.statusEditingNode", {
      name: nodeNameForStatus(diagram.nodes.find((node) => node.id === nodeTextEdit.nodeId), t)
    });
    if (labelEdit) return t("diagram.statusEditingLineLabel");
    if (lineRetarget) return t("diagram.statusRetargetingLine");
    if (connect?.isActive) return t("diagram.statusConnecting");
    if (keyboardConnectFromNodeId) return t("diagram.statusKeyboardConnecting");
    if (rangeSelect) return t("diagram.statusRangeSelecting");
    if (drag && selectedNodeIds.has(drag.nodeId) && selectedNodeIds.size > 1) return t("diagram.statusMovingMultipleNodes", {
      count: selectedNodeIds.size
    });
    if (drag) return t("diagram.statusMovingNode", {
      name: nodeNameForStatus(diagram.nodes.find((node) => node.id === drag.nodeId), t)
    });
    if (resize) return t("diagram.statusResizingNode", {
      name: nodeNameForStatus(diagram.nodes.find((node) => node.id === resize.nodeId), t)
    });
    if (selectedLineLayout) return t("diagram.statusLineSelected");
    if (selectedNodeIdList.length > 1) return t("diagram.statusMultiNodeSelected", {
      count: selectedNodeIdList.length
    });
    if (selectedEditableNode) return t("diagram.statusNodeSelected", {
      name: nodeNameForStatus(selectedEditableNode, t)
    });
    return t("diagram.statusIdle", {
      ...statusCounts
    });
  }, [
    connect?.isActive,
    diagram.nodes,
    drag,
    keyboardConnectFromNodeId,
    labelEdit,
    lineRetarget,
    nodeTextEdit,
    rangeSelect,
    resize,
    selectedEditableNode,
    selectedLineLayout,
    selectedNodeIdList.length,
    selectedNodeIds,
    statusCounts,
    t
  ]);
  const visiblePrintArea = printAreaDrag?.currentArea ?? effectivePrintArea;

  useEffect(() => {
    onStatusChange?.(diagramStatusText);
  }, [diagramStatusText, onStatusChange]);

  return (
    <div
      aria-describedby={canvasStatusDescriptionId}
      aria-label={fileName}
      className={`diagram-canvas${pan ? " diagram-canvas--panning" : ""}`}
      ref={canvasRef}
      onDragOver={handleCanvasDragOver}
      onDragLeave={handleCanvasDragLeave}
      onDrop={handleCanvasDrop}
      onKeyDown={handleCanvasKeyDown}
      onPointerCancel={cancelConnect}
      onPointerDown={startPanOnBlank}
      onPointerMove={(event) => {
        updateConnect(event);
        updateLineRetarget(event);
        updatePan(event);
        updatePrintAreaDrag(event);
        updateRangeSelect(event);
      }}
      onPointerUp={(event) => {
        cancelConnect(event);
        cancelLineRetarget(event);
        cancelNodeResize(event);
        finishPrintAreaDrag(event);
        finishPan(event);
        finishRangeSelect(event);
      }}
      onWheel={handleCanvasWheel}
      role="application"
      style={canvasStyle}
      tabIndex={0}
    >
      <span className="diagram-canvas-status-description" id={canvasStatusDescriptionId}>
        {t("diagram.canvasAriaDescription", { status: diagramStatusText })}
      </span>
      {toolbar}
      <div className="diagram-canvas-toolbar" aria-label={t("diagram.canvasToolbar")}>
        <div className="diagram-canvas-toolbar-group">
          <button className="diagram-canvas-icon-button" aria-label={t("diagram.undo")} disabled={history.past.length === 0} onClick={undoDiagramChange} title={t("diagram.undo")} type="button">
            <DiagramActionIcon name="undo" />
          </button>
          <button className="diagram-canvas-icon-button" aria-label={t("diagram.redo")} disabled={history.future.length === 0} onClick={redoDiagramChange} title={t("diagram.redo")} type="button">
            <DiagramActionIcon name="redo" />
          </button>
        </div>
        <div className="diagram-canvas-toolbar-separator" aria-hidden="true" />
        <div className="diagram-canvas-toolbar-group">
          <button className="diagram-canvas-icon-button" aria-label={t("diagram.fitCanvas")} onClick={fitViewportToContent} title={t("diagram.fitCanvas")} type="button">
            <DiagramActionIcon name="fit" />
          </button>
          <button className="diagram-canvas-icon-button" aria-label={t("diagram.zoomOut")} onClick={() => zoomViewport(0.9)} title={t("diagram.zoomOut")} type="button">
            <DiagramActionIcon name="zoomOut" />
          </button>
          <span aria-label={t("diagram.currentZoom")} className="diagram-canvas-zoom-label">{Math.round(viewport.zoom * 100)}%</span>
          <button className="diagram-canvas-icon-button" aria-label={t("diagram.zoomIn")} onClick={() => zoomViewport(1.1)} title={t("diagram.zoomIn")} type="button">
            <DiagramActionIcon name="zoomIn" />
          </button>
          <button className="diagram-canvas-icon-button" aria-label={t("diagram.resetZoom")} onClick={resetViewport} title={t("diagram.resetZoom")} type="button">
            <DiagramActionIcon name="actualSize" />
          </button>
        </div>
        <div className="diagram-canvas-toolbar-separator" aria-hidden="true" />
        <div className="diagram-canvas-toolbar-group">
          <button className="diagram-canvas-icon-button" aria-label={t("diagram.printArea")} onClick={() => setToolbarMenu((current) => current === "printArea" ? null : "printArea")} title={t("diagram.printArea")} type="button">
            <DiagramActionIcon name="printArea" />
          </button>
          <button className="diagram-canvas-icon-button" aria-label={t("diagram.paperSettings")} onClick={() => setToolbarMenu((current) => current === "paper" ? null : "paper")} title={t("diagram.paperSettings")} type="button">
            <DiagramActionIcon name="paper" />
          </button>
          <button className="diagram-canvas-icon-button" aria-label={t("output.print")} onClick={openDiagramPrintPreview} title={t("output.print")} type="button">
            <DiagramActionIcon name="print" />
          </button>
        </div>
      </div>
      {toolbarMenu === "printArea" ? (
        <div className="diagram-canvas-floating-panel diagram-canvas-print-panel">
          <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={fitPrintAreaToDiagram} type="button">
            <DiagramActionIcon name="fit" />
            {t("diagram.fitPrintArea")}
          </button>
          <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => updatePrintArea(null)} type="button">
            <DiagramActionIcon name="reset" />
            {t("diagram.clearPrintArea")}
          </button>
        </div>
      ) : null}
      {toolbarMenu === "paper" ? (
        <div className="diagram-canvas-floating-panel diagram-canvas-paper-panel">
          <label>
            <span>{t("diagram.paperSize")}</span>
            <select
              value={effectivePrintSettings.paperSize}
              onChange={(event) => updatePrintSettings({ ...effectivePrintSettings, paperSize: event.currentTarget.value as RelicDiagramPrintSettings["paperSize"] })}
            >
              {relicDiagramPaperSizes.map((paperSize) => <option key={paperSize} value={paperSize}>{paperSize}</option>)}
            </select>
          </label>
          <label>
            <span>{t("diagram.paperOrientation")}</span>
            <select
              value={effectivePrintSettings.orientation}
              onChange={(event) => updatePrintSettings({ ...effectivePrintSettings, orientation: event.currentTarget.value as RelicDiagramPrintSettings["orientation"] })}
            >
              {relicDiagramPrintOrientations.map((orientation) => <option key={orientation} value={orientation}>{t(`diagram.printOrientation.${orientation}`)}</option>)}
            </select>
          </label>
          <label>
            <span>{t("diagram.paperMargin")}</span>
            <select
              value={effectivePrintSettings.marginPreset}
              onChange={(event) => updatePrintSettings({ ...effectivePrintSettings, marginPreset: event.currentTarget.value as RelicDiagramPrintSettings["marginPreset"] })}
            >
              {relicDiagramPrintMarginPresets.map((margin) => <option key={margin} value={margin}>{t(`diagram.printMargin.${margin}`)}</option>)}
            </select>
          </label>
          <label>
            <span>{t("diagram.printScaleMode")}</span>
            <select
              value={effectivePrintSettings.scaleMode}
              onChange={(event) => updatePrintSettings({ ...effectivePrintSettings, scaleMode: event.currentTarget.value as RelicDiagramPrintSettings["scaleMode"] })}
            >
              {relicDiagramPrintScaleModes.map((scaleMode) => <option key={scaleMode} value={scaleMode}>{t(`diagram.printScaleMode.${scaleMode}`)}</option>)}
            </select>
          </label>
          <label>
            <span>{t("diagram.printScale")}</span>
            <input
              max={200}
              min={10}
              onChange={(event) => updatePrintSettings({ ...effectivePrintSettings, scale: Number(event.currentTarget.value) / 100 })}
              step={5}
              type="number"
              value={Math.round(effectivePrintSettings.scale * 100)}
            />
          </label>
        </div>
      ) : null}
      {contextMenu ? (
        <DiagramContextMenu
          contextMenu={contextMenu}
          selectedEditableNode={selectedEditableNode}
          selectedLineLayout={selectedLineLayout ?? null}
          selectedNodeIdList={selectedNodeIdList}
          onAlignSelection={alignSelection}
          onChangeLineLabelSize={changeSelectedLineLabelSize}
          onChangeSelectedNodesAppearance={changeSelectedNodesAppearance}
          onChangeSelectedNodeShape={changeSelectedNodeShape}
          onClose={() => setContextMenu(null)}
          onCopySelection={copySelection}
          onDeleteSelection={deleteSelection}
          onDistributeSelection={distributeSelection}
          onDuplicateSelection={duplicateSelection}
          onReverseLineDirection={reverseSelectedLineDirection}
          t={t}
        />
      ) : null}
      {notice ? (
        <output aria-live="polite" className="diagram-canvas-notice" role="status">{notice}</output>
      ) : null}
      {layout.nodes.length === 0 ? (
        <div className="diagram-canvas-empty-panel">
          {onChange ? (
            <div className="diagram-canvas-empty-actions">
              <h2>{t("diagram.emptyShapeMenu")}</h2>
              <div className="diagram-canvas-empty-menu" role="menu" aria-label={t("diagram.emptyShapeMenu")}>
                {freeDrawingShapeGroups.map((group) => (
                  <div className="diagram-canvas-empty-menu-group" key={group.title}>
                    <p>{group.title}</p>
                    {group.items.map((item) => (
                      <button
                        className={`diagram-canvas-node-add-shape-option diagram-canvas-node-add-shape-option--${item.shape}`}
                        key={item.shape}
                        onClick={() => addFreeDrawingNodeAtVisibleCenter(item.shape)}
                        role="menuitem"
                        type="button"
                      >
                        <span className="diagram-canvas-node-add-shape-icon" aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div
        className="diagram-canvas-space"
        onPointerDown={clearSelectionOnBlankPointerDown}
        style={{
          height: layout.height,
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
          width: layout.width
        }}
      >
        {toolbarMenu === "printArea" || diagram.printArea || printAreaDrag ? (
          <div
            aria-label={t("diagram.printArea")}
            className="diagram-canvas-print-area"
            onPointerDown={(event) => startPrintAreaDrag("move", event)}
            role="group"
            style={{
              height: visiblePrintArea.height,
              left: visiblePrintArea.x - layout.originX,
              top: visiblePrintArea.y - layout.originY,
              width: visiblePrintArea.width
            }}
          >
            {(["top", "right", "bottom", "left"] as const).map((edge) => (
              <button
                aria-label={t(`diagram.printAreaHandle.${edge}`)}
                className={`diagram-canvas-print-area-handle diagram-canvas-print-area-handle--${edge}`}
                key={edge}
                onPointerDown={(event) => startPrintAreaDrag(edge, event)}
                tabIndex={-1}
                type="button"
              />
            ))}
          </div>
        ) : null}
        <DiagramLineLayer
          height={layout.height}
          lines={displayLines}
          onLineContextMenu={openLineContextMenu}
          onLineDoubleClick={startLabelEditFromLine}
          onLinePointerDown={selectLine}
          previewLine={previewLine}
          selection={selection}
          width={layout.width}
        />
        {selectedLineLayout ? (
          <div className="diagram-canvas-line-endpoint-handles" style={{ zIndex: selectedLineLayout.displayLayer + 1 }}>
            <button
              aria-label={t("diagram.retargetLineFrom")}
              className="diagram-canvas-line-endpoint-handle diagram-canvas-line-endpoint-handle--from"
              onPointerDown={(event) => startLineRetarget(selectedLineLayout, "from", event)}
              style={{ left: selectedLineLayout.x1, top: selectedLineLayout.y1 }}
              type="button"
            />
            <button
              aria-label={t("diagram.retargetLineTo")}
              className="diagram-canvas-line-endpoint-handle diagram-canvas-line-endpoint-handle--to"
              onPointerDown={(event) => startLineRetarget(selectedLineLayout, "to", event)}
              style={{ left: selectedLineLayout.x2, top: selectedLineLayout.y2 }}
              type="button"
            />
          </div>
        ) : null}
        <DiagramSnapGuides guides={displaySnapGuides} height={layout.height} width={layout.width} />
        <div className="diagram-canvas-labels">
          {displayLines.map((line) => {
            const isSelectedLine = selection?.type === "line" && selection.id === line.line.id;
            if (labelEdit?.lineId === line.line.id) {
              return (
                <form
                  className="diagram-canvas-label-editor"
                  key={line.line.id}
                  onSubmit={submitLabelEdit}
                  style={{
                    fontSize: diagramLineLabelFontSize(line.line),
                    left: line.labelX,
                    top: line.labelY,
                    zIndex: line.displayLayer
                  }}
                >
                  <input
                    aria-label={t("diagram.editLineLabel")}
                    autoFocus
                    onBlur={commitLabelEdit}
                    onChange={(event) => changeLabelEditValue(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelLabelEdit();
                      }
                    }}
                    value={labelEdit.value}
                  />
                </form>
              );
            }

            if (!line.label && selection?.type !== "line") return null;
            if (!line.label && selection?.id !== line.line.id) return null;

            return (
              <div
                className="diagram-canvas-line-controls"
                key={line.line.id}
                style={{
                  fontSize: diagramLineLabelFontSize(line.line),
                  left: line.labelX,
                  top: line.labelY,
                  zIndex: line.displayLayer
                }}
              >
                {isSelectedLine ? (
                  <span
                    className={`diagram-canvas-line-label${line.label ? "" : " diagram-canvas-line-label--empty"}`}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      beginLabelEdit(line);
                    }}
                  >
                    {line.label || t("diagram.addLineLabel")}
                  </span>
                ) : (
                  <button
                    aria-label={t("diagram.editLineLabel")}
                    className={`diagram-canvas-line-label${line.label ? "" : " diagram-canvas-line-label--empty"}`}
                    onPointerDown={(event) => startLabelEditFromButton(line, event)}
                    type="button"
                  >
                    {line.label || t("diagram.addLineLabel")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="diagram-canvas-nodes">
          {dragDropPreview || paletteDropPreview ? (
            <div
              aria-hidden="true"
              className="diagram-canvas-drop-preview"
              style={{
                height: (dragDropPreview ?? paletteDropPreview)?.height,
                left: (dragDropPreview ?? paletteDropPreview)?.x,
                top: (dragDropPreview ?? paletteDropPreview)?.y,
                width: (dragDropPreview ?? paletteDropPreview)?.width
              }}
            />
          ) : null}
          {resize && resizePreview ? (
            <div
              aria-hidden="true"
              className="diagram-canvas-drop-preview diagram-canvas-resize-preview"
              style={{
                height: resize.currentHeight,
                left: resizePreview.x,
                top: resizePreview.y,
                width: resize.currentWidth
              }}
            />
          ) : null}
          {rangeSelectRect ? (
            <div
              aria-hidden="true"
              className="diagram-canvas-range-select"
              style={{
                height: rangeSelectRect.height,
                left: rangeSelectRect.x - layout.originX,
                top: rangeSelectRect.y - layout.originY,
                width: rangeSelectRect.width
              }}
            />
          ) : null}
          {displayNodes.map(({ node, x, y }) => (
              <DiagramNodeView
                isDragging={drag?.nodeId === node.id}
                isTextEditing={nodeTextEdit?.nodeId === node.id}
                isSelected={(selection?.type === "node" && selection.id === node.id) || selectedNodeIds.has(node.id)}
                nodeAriaLabel={diagramNodeAriaLabel(
                  node,
                  (selection?.type === "node" && selection.id === node.id) || selectedNodeIds.has(node.id),
                  lineRetargetNodeState(node.id),
                  t
                )}
                connectionTargetState={lineRetargetNodeState(node.id)}
                key={node.id}
                node={node}
                nodeTextDraft={nodeTextEdit?.nodeId === node.id ? nodeTextEdit.value : undefined}
                nodeTextLabel={"shape" in node && node.shape === "area"
                  ? t("diagram.freeDrawingAreaName")
                  : t("diagram.freeDrawingNodeText")}
                onNodeTextCancel={cancelFreeDrawingNodeText}
                onNodeTextChange={isFreeDrawing ? changeFreeDrawingNodeText : undefined}
                onNodeTextCommit={commitFreeDrawingNodeText}
                onNodeTextDoubleClick={beginFreeDrawingNodeTextEdit}
                onContextMenu={openNodeContextMenu}
                onOutlinePointerDown={startNodeOutlineConnect}
                onPointerCancel={cancelNodeDrag}
                onPointerDown={startNodePointer}
                onFocus={focusNode}
                onPointerMove={(event) => {
                  updateNodeDrag(event);
                  updateNodeResize(event);
                }}
                onResizePointerDown={startNodeResize}
                onPointerUp={finishNodePointer}
                renderNodeText={!isFreeDrawing}
                resizeLabel={t("diagram.resizeNode")}
                x={x}
                y={y}
              />
          ))}
        </div>
        {isFreeDrawing ? (
          <div className="diagram-canvas-node-labels">
            {displayNodes.map(({ node, x, y }) => {
              if (!("text" in node)) return null;

              const isArea = node.shape === "area";
              const labelClassName = [
                "diagram-canvas-node-label-frame",
                `diagram-canvas-node-label-frame--shape-${node.shape}`,
                isArea ? "diagram-canvas-node-label-frame--area" : ""
              ].filter(Boolean).join(" ");
              const labelStyle: CSSProperties = {
                alignContent: diagramNodeAlignItems(node.verticalAlign),
                color: diagramNodeTextColor(node) ?? undefined,
                fontSize: diagramNodeFontSize(node),
                height: node.height,
                justifyItems: diagramNodeJustifyItems(node.textAlign),
                left: x,
                top: y,
                width: node.width,
                zIndex: diagramFreeDrawingLabelDisplayLayer()
              };

              return (
                <div
                  className={labelClassName}
                  key={node.id}
                  onDoubleClick={(event) => beginFreeDrawingNodeTextEdit(node, event)}
                  style={labelStyle}
                >
                  {nodeTextEdit?.nodeId === node.id ? (
                    <textarea
                      aria-label={isArea ? t("diagram.freeDrawingAreaName") : t("diagram.freeDrawingNodeText")}
                      autoFocus
                      className={[
                        "diagram-canvas-node-text",
                        isArea ? "diagram-canvas-node-text--area-name" : ""
                      ].filter(Boolean).join(" ")}
                      onBlur={commitFreeDrawingNodeText}
                      onChange={(event) => changeFreeDrawingNodeText(node.id, event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelFreeDrawingNodeText();
                        }
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      style={{
                        color: diagramNodeTextColor(node) ?? undefined,
                        fontSize: diagramNodeFontSize(node),
                        textAlign: node.textAlign ?? (isArea ? "left" : "center")
                      }}
                      value={nodeTextEdit.value}
                    />
                  ) : (
                    <span className={[
                      "diagram-canvas-node-name",
                      "diagram-canvas-node-name--free-text",
                      isArea ? "diagram-canvas-node-name--area-name" : ""
                    ].filter(Boolean).join(" ")}
                    style={{
                      color: diagramNodeTextColor(node) ?? undefined,
                      fontSize: diagramNodeFontSize(node),
                      textAlign: node.textAlign ?? (isArea ? "left" : "center")
                    }}
                    >
                      {node.text || (isArea ? t("diagram.freeDrawingAreaName") : t("diagram.freeDrawingNodeText"))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface DiagramContextMenuProps {
  contextMenu: DiagramContextMenuState;
  selectedEditableNode: RelicConnectedDiagramNode | null;
  selectedLineLayout: DiagramCanvasLineLayout | null | undefined;
  selectedNodeIdList: string[];
  onAlignSelection: (direction: "horizontal" | "vertical") => void;
  onChangeLineLabelSize: (labelTextSize: RelicDiagramTextSize | null) => void;
  onChangeSelectedNodesAppearance: (appearance: Parameters<typeof updateRelicDiagramNodesAppearance>[2]) => void;
  onChangeSelectedNodeShape: (shape: RelicFreeDrawingShapeType) => void;
  onClose: () => void;
  onCopySelection: () => void;
  onDeleteSelection: () => void;
  onDistributeSelection: (direction: "horizontal" | "vertical") => void;
  onDuplicateSelection: () => void;
  onReverseLineDirection: (line: DiagramCanvasLineLayout, event: ReactPointerEvent<HTMLButtonElement>) => void;
  t: Translator;
}

function DiagramContextMenu({
  contextMenu,
  selectedEditableNode,
  selectedLineLayout,
  selectedNodeIdList,
  onAlignSelection,
  onChangeLineLabelSize,
  onChangeSelectedNodesAppearance,
  onChangeSelectedNodeShape,
  onClose,
  onCopySelection,
  onDeleteSelection,
  onDistributeSelection,
  onDuplicateSelection,
  onReverseLineDirection,
  t
}: DiagramContextMenuProps): ReactElement {
  const run = (action: () => void): void => {
    action();
    onClose();
  };
  const isNodeMenu = contextMenu.type === "node";
  const isMultiNodeMenu = isNodeMenu && selectedNodeIdList.length > 1;

  return (
    <div
      className="diagram-canvas-action-menu tab-context-menu"
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
      style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 40 }}
    >
      {isNodeMenu ? (
        <>
          <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(onCopySelection)} role="menuitem" type="button">
            <DiagramActionIcon name="copy" />
            {t("diagram.copySelection")}
          </button>
          <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(onDuplicateSelection)} role="menuitem" type="button">
            <DiagramActionIcon name="duplicate" />
            {t("diagram.duplicate")}
          </button>
          {isMultiNodeMenu ? (
            <>
              <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(() => onAlignSelection("horizontal"))} role="menuitem" type="button">
                <DiagramActionIcon name="alignHorizontal" />
                {t("diagram.alignHorizontal")}
              </button>
              <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(() => onAlignSelection("vertical"))} role="menuitem" type="button">
                <DiagramActionIcon name="alignVertical" />
                {t("diagram.alignVertical")}
              </button>
              <button
                className="tab-context-menu-item tab-context-menu-item--icon"
                disabled={selectedNodeIdList.length < 3}
                onClick={() => run(() => onDistributeSelection("horizontal"))}
                role="menuitem"
                type="button"
              >
                <DiagramActionIcon name="distributeHorizontal" />
                {t("diagram.distributeHorizontal")}
              </button>
              <button
                className="tab-context-menu-item tab-context-menu-item--icon"
                disabled={selectedNodeIdList.length < 3}
                onClick={() => run(() => onDistributeSelection("vertical"))}
                role="menuitem"
                type="button"
              >
                <DiagramActionIcon name="distributeVertical" />
                {t("diagram.distributeVertical")}
              </button>
            </>
          ) : null}
          {!isMultiNodeMenu && selectedEditableNode && selectedEditableNode.shape !== "area" ? (
            <label className="tab-context-menu-item tab-context-menu-item--icon diagram-canvas-action-menu-select">
              <DiagramActionIcon name="shapes" />
              <span>{t("diagram.changeShape")}</span>
              <select
                aria-label={t("diagram.changeShape")}
                onChange={(event) => {
                  onChangeSelectedNodeShape(event.currentTarget.value as RelicFreeDrawingShapeType);
                  onClose();
                }}
                value={selectedEditableNode.shape}
              >
                {relicFreeDrawingShapeTypes.filter((shape) => shape !== "area").map((shape) => (
                  <option key={shape} value={shape}>{t(`diagram.freeDrawingShape.${shape}`)}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="diagram-canvas-menu-section" role="group" aria-label={t("diagram.nodeColor")}>
            <button className="diagram-canvas-swatch-button diagram-canvas-swatch-button--default" onClick={() => run(() => onChangeSelectedNodesAppearance({ color: null }))} type="button">
              <span aria-hidden="true" />
            </button>
            {relicDiagramNodeColorPresets.map((color) => (
              <button
                aria-label={t(`diagram.nodeColor.${color}`)}
                className={`diagram-canvas-swatch-button diagram-canvas-swatch-button--${color}${selectedEditableNode?.color === color ? " diagram-canvas-swatch-button--selected" : ""}`}
                key={color}
                onClick={() => run(() => onChangeSelectedNodesAppearance({ color }))}
                type="button"
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="diagram-canvas-menu-section" role="group" aria-label={t("diagram.nodeTextSize")}>
            <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(() => onChangeSelectedNodesAppearance({ textSize: "small" }))} type="button"><DiagramActionIcon name="textSmall" />{t("diagram.textSize.small")}</button>
            <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(() => onChangeSelectedNodesAppearance({ textSize: null }))} type="button"><DiagramActionIcon name="reset" />{t("diagram.textSize.default")}</button>
            <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(() => onChangeSelectedNodesAppearance({ textSize: "large" }))} type="button"><DiagramActionIcon name="textLarge" />{t("diagram.textSize.large")}</button>
          </div>
          <div className="diagram-canvas-menu-section" role="group" aria-label={t("diagram.nodeTextAlign")}>
            <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(() => onChangeSelectedNodesAppearance({ textAlign: "left" }))} type="button"><DiagramActionIcon name="alignTextLeft" />{t("diagram.textAlign.left")}</button>
            <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(() => onChangeSelectedNodesAppearance({ textAlign: null, verticalAlign: null }))} type="button"><DiagramActionIcon name="reset" />{t("diagram.textAlign.default")}</button>
            <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(() => onChangeSelectedNodesAppearance({ textAlign: "right" }))} type="button"><DiagramActionIcon name="alignTextRight" />{t("diagram.textAlign.right")}</button>
            <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(() => onChangeSelectedNodesAppearance({ verticalAlign: "top" }))} type="button"><DiagramActionIcon name="alignTextTop" />{t("diagram.verticalAlign.top")}</button>
            <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(() => onChangeSelectedNodesAppearance({ verticalAlign: "bottom" }))} type="button"><DiagramActionIcon name="alignTextBottom" />{t("diagram.verticalAlign.bottom")}</button>
          </div>
          <button className="tab-context-menu-item tab-context-menu-item--icon danger" onClick={() => run(onDeleteSelection)} role="menuitem" type="button">
            <DiagramActionIcon name="trash" />
            {t("diagram.deleteSelection")}
          </button>
        </>
      ) : selectedLineLayout ? (
        <>
          <button
            className="tab-context-menu-item tab-context-menu-item--icon"
            onPointerDown={(event) => {
              onReverseLineDirection(selectedLineLayout, event);
              onClose();
            }}
            role="menuitem"
            type="button"
          >
            <DiagramActionIcon name="reverse" />
            {t("diagram.reverseLineDirection")}
          </button>
          <div className="diagram-canvas-menu-section" role="group" aria-label={t("diagram.lineLabelTextSize")}>
            <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(() => onChangeLineLabelSize("small"))} type="button"><DiagramActionIcon name="textSmall" />{t("diagram.textSize.small")}</button>
            <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(() => onChangeLineLabelSize(null))} type="button"><DiagramActionIcon name="reset" />{t("diagram.textSize.default")}</button>
            <button className="tab-context-menu-item tab-context-menu-item--icon" onClick={() => run(() => onChangeLineLabelSize("large"))} type="button"><DiagramActionIcon name="textLarge" />{t("diagram.textSize.large")}</button>
          </div>
          <button className="tab-context-menu-item tab-context-menu-item--icon danger" onClick={() => run(onDeleteSelection)} role="menuitem" type="button">
            <DiagramActionIcon name="trash" />
            {t("diagram.deleteSelection")}
          </button>
        </>
      ) : null}
    </div>
  );
}

type DiagramActionIconName =
  | "actualSize"
  | "alignHorizontal"
  | "alignTextBottom"
  | "alignTextLeft"
  | "alignTextRight"
  | "alignTextTop"
  | "alignVertical"
  | "copy"
  | "distributeHorizontal"
  | "distributeVertical"
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

function DiagramActionIcon({ name }: { name: DiagramActionIconName }): ReactElement {
  const paths: Record<DiagramActionIconName, ReactElement> = {
    actualSize: <><path d="M7 7h10v10H7z" /><path d="M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4" /></>,
    alignHorizontal: <><path d="M4 12h16" /><rect height="4" rx="1" width="6" x="5" y="5" /><rect height="4" rx="1" width="9" x="10" y="15" /></>,
    alignTextBottom: <><path d="M5 19h14" /><path d="M8 15h8M9 11h6M10 7h4" /></>,
    alignTextLeft: <><path d="M5 7h14M5 11h9M5 15h12M5 19h7" /></>,
    alignTextRight: <><path d="M5 7h14M10 11h9M7 15h12M12 19h7" /></>,
    alignTextTop: <><path d="M5 5h14" /><path d="M8 9h8M9 13h6M10 17h4" /></>,
    alignVertical: <><path d="M12 4v16" /><rect height="6" rx="1" width="4" x="5" y="5" /><rect height="9" rx="1" width="4" x="15" y="10" /></>,
    copy: <><rect height="11" rx="2" width="9" x="9" y="7" /><path d="M6 14V5a2 2 0 0 1 2-2h8" /></>,
    distributeHorizontal: <><path d="M4 5v14M20 5v14" /><rect height="6" rx="1" width="4" x="7" y="9" /><rect height="6" rx="1" width="4" x="13" y="9" /></>,
    distributeVertical: <><path d="M5 4h14M5 20h14" /><rect height="4" rx="1" width="6" x="9" y="7" /><rect height="4" rx="1" width="6" x="9" y="13" /></>,
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

function isBlankCanvasTarget(target: EventTarget, currentTarget: Element): boolean {
  return target === currentTarget ||
    (target instanceof Element && target.tagName.toLowerCase() === "svg") ||
    (target instanceof Element && target.classList.contains("diagram-canvas-empty")) ||
    (target instanceof Element && target.classList.contains("diagram-canvas-lines")) ||
    (target instanceof Element && target.classList.contains("diagram-canvas-labels")) ||
    (target instanceof Element && target.classList.contains("diagram-canvas-node-labels")) ||
    (target instanceof Element && target.classList.contains("diagram-canvas-nodes")) ||
    (target instanceof Element && target.classList.contains("diagram-canvas-space"));
}

function focusCanvasFrom(element: Element): void {
  const canvas = element.closest(".diagram-canvas");
  if (canvas instanceof HTMLElement) {
    canvas.focus({ preventScroll: true });
  }
}

function diagramNodeAriaLabel(
  node: RelicConnectedDiagramNode,
  isSelected: boolean,
  connectionTargetState: "available" | "blocked" | undefined,
  t: Translator
): string {
  const name = nodeNameForStatus(node, t);
  const shape = freeDrawingShapeLabel(node.shape, t);
  const selected = isSelected ? t("diagram.nodeAriaSelected") : t("diagram.nodeAriaNotSelected");
  const connection = connectionTargetState === "available"
    ? ` ${t("diagram.nodeAriaConnectionAvailable")}`
    : connectionTargetState === "blocked"
    ? ` ${t("diagram.nodeAriaConnectionBlocked")}`
    : "";

  return t("diagram.nodeAriaLabel", { connection, name, selected, shape });
}

function nodeNameForStatus(node: RelicConnectedDiagramNode | undefined, t: Translator): string {
  if (!node) return t("diagram.freeDrawingNodeText");

  return node.text.trim() || freeDrawingShapeLabel(node.shape, t);
}

function freeDrawingShapeLabel(shape: RelicFreeDrawingShapeType, t: Translator): string {
  return t(`diagram.freeDrawingShape.${shape}` as TranslationKey);
}

function rectanglesOverlap(
  leftA: number,
  topA: number,
  widthA: number,
  heightA: number,
  leftB: number,
  topB: number,
  widthB: number,
  heightB: number
): boolean {
  return leftA < leftB + widthB &&
    leftA + widthA > leftB &&
    topA < topB + heightB &&
    topA + heightA > topB;
}

function isNodeFullyInsideNode(node: RelicDiagramNodeBase, container: RelicDiagramNodeBase): boolean {
  return node.id !== container.id &&
    node.x >= container.x &&
    node.y >= container.y &&
    node.x + node.width <= container.x + container.width &&
    node.y + node.height <= container.y + container.height;
}

function canAddDecisionOutputLine(
  node: RelicDiagramNodeBase | undefined,
  lines: RelicDiagramLine[],
  _nodes: RelicConnectedDiagramNode[]
): boolean {
  if (!node || !("shape" in node) || node.shape !== "decision") return true;

  return lines.filter((line) => line.from === node.id).length < decisionOptionLabels.length;
}

function decisionLineLabel(
  node: RelicConnectedDiagramNode | undefined,
  lines: RelicDiagramLine[],
  _nodes: RelicConnectedDiagramNode[]
): string {
  if (!node || !("shape" in node) || node.shape !== "decision") return "";

  const outgoingCount = lines.filter((line) => line.from === node.id).length;
  return decisionOptionLabels[outgoingCount] ?? "";
}

function connectedFreeDrawingShapeSize(shape: RelicFreeDrawingShapeType): { height: number; width: number } {
  if (shape === "area") {
    return {
      height: 224,
      width: 384
    };
  }

  return {
    height: connectedShapeDefaultHeight,
    width: connectedShapeDefaultWidth
  };
}

function freeDrawingShapeOpenPosition(
  shape: RelicFreeDrawingShapeType,
  x: number,
  y: number,
  nodes: RelicConnectedDiagramNode[],
  originX: number,
  originY: number
): { x: number; y: number } {
  const size = connectedFreeDrawingShapeSize(shape);
  const base = snapDiagramPointToGrid(x, y, originX, originY);
  const offsets = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 2, y: 0 },
    { x: 0, y: 2 },
    { x: 2, y: 1 },
    { x: 1, y: 2 }
  ];

  for (const offset of offsets) {
    const candidate = snapDiagramPointToGrid(
      base.x + offset.x * (size.width + diagramGridSize),
      base.y + offset.y * (size.height + diagramGridSize),
      originX,
      originY
    );
    const overlaps = nodes.some((node) => rectanglesOverlap(
      candidate.x,
      candidate.y,
      size.width,
      size.height,
      node.x,
      node.y,
      node.width,
      node.height
    ));
    if (!overlaps) return candidate;
  }

  return base;
}

function arrowDelta(key: string, step: number): { x: number; y: number } {
  if (key === "ArrowLeft") return { x: -step, y: 0 };
  if (key === "ArrowRight") return { x: step, y: 0 };
  if (key === "ArrowUp") return { x: 0, y: -step };
  if (key === "ArrowDown") return { x: 0, y: step };

  return { x: 0, y: 0 };
}

function normalizeSelectionRect(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number
): { height: number; width: number; x: number; y: number } {
  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);

  return {
    height: Math.abs(currentY - startY),
    width: Math.abs(currentX - startX),
    x,
    y
  };
}
