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
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  addRelicFreeDrawingNode,
  addRelicDiagramLine,
  alignRelicDiagramNodes,
  distributeRelicDiagramNodes,
  duplicateRelicDiagramNodes,
  moveRelicDiagramNode,
  moveRelicDiagramNodesByDelta,
  moveRelicFreeDrawingAreaWithContents,
  relicFreeDrawingShapeTypes,
  removeRelicDiagramLine,
  removeRelicDiagramNode,
  removeRelicDiagramNodes,
  reverseRelicDiagramLineDirection,
  resizeRelicDiagramNode,
  updateRelicFreeDrawingNodeShape,
  updateRelicFreeDrawingNodeText,
  updateRelicDiagramLineEndpoints,
  updateRelicDiagramLineLabel,
  type RelicConnectedDiagramDocument,
  type RelicConnectedDiagramNode,
  type RelicDiagramLine,
  type RelicDiagramNodeBase,
  type RelicFreeDrawingShapeType
} from "../../../shared/diagramMarkdown";
import { useT } from "../../i18n";
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
import { diagramShapePaletteGroups, diagramShapePaletteItems } from "./diagramShapePalette";
import { DiagramLineLayer } from "./DiagramLineLayer";
import { diagramFreeDrawingLabelDisplayLayer, diagramNodeDisplayLayer } from "./diagramLayering";
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

interface ShapeAddMenuState {
  nodeId: string;
}

interface DiagramShapePaletteAddRequest {
  handled: boolean;
  shape: RelicFreeDrawingShapeType;
}

export function DiagramCanvasSurface({
  content,
  diagram,
  fileName,
  onChange,
  toolbar
}: DiagramCanvasProps & { diagram: RelicConnectedDiagramDocument }): ReactElement {
  const t = useT();
  const isFreeDrawing = diagram.type === "diagram";
  const [connect, setConnect] = useState<ConnectState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [labelEdit, setLabelEdit] = useState<LabelEditState | null>(null);
  const [nodeTextEdit, setNodeTextEdit] = useState<NodeTextEditState | null>(null);
  const [pan, setPan] = useState<PanState | null>(null);
  const [rangeSelect, setRangeSelect] = useState<RangeSelectState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [lineRetarget, setLineRetarget] = useState<LineRetargetState | null>(null);
  const [paletteDropPreview, setPaletteDropPreview] = useState<{ height: number; width: number; x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<DiagramSelection | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [shapeAddMenu, setShapeAddMenu] = useState<ShapeAddMenuState | null>(null);
  const [emptyShapeMenuOpen, setEmptyShapeMenuOpen] = useState(false);
  const [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<{ future: string[]; past: string[] }>({ future: [], past: [] });
  const [copiedNodeIds, setCopiedNodeIds] = useState<string[]>([]);
  const [keyboardConnectFromNodeId, setKeyboardConnectFromNodeId] = useState<string | null>(null);

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
  const freeDrawingShapeOptions = useMemo(() => diagramShapePaletteItems(t), [t]);
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
    setShapeAddMenu(null);
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
    setShapeAddMenu(null);
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
    setSelection(null);
    setSelectedNodeIds(new Set());
    setLabelEdit(null);
    setNodeTextEdit(null);
    setShapeAddMenu(null);
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
    setShapeAddMenu(null);
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
    setShapeAddMenu(null);
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
      setShapeAddMenu(null);
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
      setShapeAddMenu(null);
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
    setShapeAddMenu(null);
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
    setShapeAddMenu(null);
    focusCanvasFrom(event.currentTarget);
  };
  const beginLabelEdit = (line: DiagramCanvasLineLayout): void => {
    if (!onChange) return;

    setSelection({ id: line.line.id, type: "line" });
    setSelectedNodeIds(new Set());
    setNodeTextEdit(null);
    setShapeAddMenu(null);
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
      setSelection(null);
      setSelectedNodeIds(new Set());
      setLabelEdit(null);
      setNodeTextEdit(null);
      setShapeAddMenu(null);
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
      setShapeAddMenu(null);
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
      setShapeAddMenu(null);
      setEmptyShapeMenuOpen(false);
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
  const connectedFreeDrawingNodePosition = (sourceNode: RelicDiagramNodeBase, shape: RelicFreeDrawingShapeType): { x: number; y: number } => {
    const size = connectedFreeDrawingShapeSize(shape);
    const baseX = sourceNode.x + sourceNode.width + diagramGridSize * 2;
    const baseY = sourceNode.y;
    let candidate = snapDiagramPointToGrid(baseX, baseY, layout.originX, layout.originY);

    for (let attempt = 0; attempt <= diagram.nodes.length; attempt += 1) {
      const overlaps = diagram.nodes.some((node) => rectanglesOverlap(
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

      candidate = snapDiagramPointToGrid(
        baseX,
        baseY + (size.height + diagramGridSize) * (attempt + 1),
        layout.originX,
        layout.originY
      );
    }

    return candidate;
  };
  const addConnectedFreeDrawingNode = (
    sourceNode: RelicConnectedDiagramNode,
    shape: RelicFreeDrawingShapeType
  ): void => {
    if (!onChange || !isFreeDrawing) return;
    if (!canAddDecisionOutputLine(sourceNode, diagram.lines, diagram.nodes)) return;

    const position = connectedFreeDrawingNodePosition(sourceNode, shape);
    const added = addRelicFreeDrawingNode(content, shape, position.x, position.y);
    if (!added.ok) return;

    const lineAdded = addRelicDiagramLine(
      added.value.content,
      sourceNode.id,
      added.value.node.id,
      decisionLineLabel(sourceNode, diagram.lines, diagram.nodes)
    );
    if (!lineAdded.ok) return;

    applyContentChange(lineAdded.value.content);
    setSelection({ id: added.value.node.id, type: "node" });
    setSelectedNodeIds(new Set([added.value.node.id]));
    setShapeAddMenu(null);
  };
  const toggleShapeAddMenu = (
    node: RelicConnectedDiagramNode,
    event: ReactPointerEvent<HTMLButtonElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!isFreeDrawing || !("shape" in node)) return;

    setSelection({ id: node.id, type: "node" });
    setLabelEdit(null);
    setNodeTextEdit(null);
    setShapeAddMenu((current) => current?.nodeId === node.id ? null : { nodeId: node.id });
    focusCanvasFrom(event.currentTarget);
  };
  const chooseConnectedShape = (
    node: RelicConnectedDiagramNode,
    shape: RelicFreeDrawingShapeType,
    event: ReactPointerEvent<HTMLButtonElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!("shape" in node)) return;

    addConnectedFreeDrawingNode(node, shape);
  };
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
    setShapeAddMenu(null);
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
      setShapeAddMenu(null);
    } else {
      showNotice(reversed.error.message);
    }
  };
  const selectedEditableNode = selection?.type === "node"
    ? diagram.nodes.find((node) => node.id === selection.id)
    : null;
  const selectedLineLayout = selection?.type === "line"
    ? displayLines.find((line) => line.line.id === selection.id)
    : null;
  const selectedNodeIdList = selectedNodeIds.size > 0
    ? [...selectedNodeIds]
    : selection?.type === "node"
    ? [selection.id]
    : [];
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
      setConnect(null);
      setDrag(null);
      setEmptyShapeMenuOpen(false);
      setLabelEdit(null);
      setLineRetarget(null);
      setNodeTextEdit(null);
      setPan(null);
      setRangeSelect(null);
      setResize(null);
      setSelection(null);
      setSelectedNodeIds(new Set());
      setShapeAddMenu(null);
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
  const nodeContextToolbarStyle = selectedNodeLayouts.length > 0
    ? floatingToolbarStyleForNodes(selectedNodeLayouts, viewport)
    : undefined;
  const lineContextToolbarStyle = selectedLineLayout
    ? floatingToolbarStyleForLine(selectedLineLayout, viewport)
    : undefined;

  return (
    <div
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
        updateRangeSelect(event);
      }}
      onPointerUp={(event) => {
        cancelConnect(event);
        cancelLineRetarget(event);
        cancelNodeResize(event);
        finishPan(event);
        finishRangeSelect(event);
      }}
      onWheel={handleCanvasWheel}
      role="img"
      style={canvasStyle}
      tabIndex={0}
    >
      {toolbar}
      <div className="diagram-canvas-toolbar" aria-label={t("diagram.canvasToolbar")}>
        <div className="diagram-canvas-toolbar-group">
          <button aria-label={t("diagram.undo")} disabled={history.past.length === 0} onClick={undoDiagramChange} title={t("diagram.undo")} type="button">
            {t("diagram.undo")}
          </button>
          <button aria-label={t("diagram.redo")} disabled={history.future.length === 0} onClick={redoDiagramChange} title={t("diagram.redo")} type="button">
            {t("diagram.redo")}
          </button>
          <button aria-label={t("diagram.fitCanvas")} onClick={fitViewportToContent} title={t("diagram.fitCanvas")} type="button">
            {t("diagram.fitCanvasShort")}
          </button>
          <button aria-label={t("diagram.zoomOut")} onClick={() => zoomViewport(0.9)} title={t("diagram.zoomOut")} type="button">
            -
          </button>
          <span aria-label={t("diagram.currentZoom")} className="diagram-canvas-zoom-label">{Math.round(viewport.zoom * 100)}%</span>
          <button aria-label={t("diagram.zoomIn")} onClick={() => zoomViewport(1.1)} title={t("diagram.zoomIn")} type="button">
            +
          </button>
          <button aria-label={t("diagram.resetZoom")} onClick={resetViewport} title={t("diagram.resetZoom")} type="button">
            100%
          </button>
        </div>
      </div>
      {selection?.type === "node" && selectedNodeIdList.length > 0 ? (
        <div
          className="diagram-canvas-context-toolbar"
          aria-label={selectedNodeIdList.length > 1 ? t("diagram.multiNodeToolbar") : t("diagram.nodeToolbar")}
          style={nodeContextToolbarStyle}
        >
          {selectedNodeIdList.length === 1 && selectedEditableNode ? (
            <button onClick={() => setNodeTextEdit({ nodeId: selectedEditableNode.id, value: selectedEditableNode.text })} type="button">
              {t("diagram.editNodeText")}
            </button>
          ) : null}
          <button onClick={copySelection} type="button">{t("diagram.copySelection")}</button>
          <button onClick={duplicateSelection} type="button">{t("diagram.duplicate")}</button>
          {selectedNodeIdList.length > 1 ? (
            <details className="diagram-canvas-context-menu">
              <summary>{t("diagram.alignMenu")}</summary>
              <div className="diagram-canvas-context-menu-list">
                <button onClick={() => alignSelection("horizontal")} type="button">{t("diagram.alignHorizontal")}</button>
                <button onClick={() => alignSelection("vertical")} type="button">{t("diagram.alignVertical")}</button>
                <button disabled={selectedNodeIdList.length < 3} onClick={() => distributeSelection("horizontal")} type="button">{t("diagram.distributeHorizontal")}</button>
                <button disabled={selectedNodeIdList.length < 3} onClick={() => distributeSelection("vertical")} type="button">{t("diagram.distributeVertical")}</button>
              </div>
            </details>
          ) : null}
          {selectedNodeIdList.length === 1 && selectedEditableNode && selectedEditableNode.shape !== "area" ? (
            <label className="diagram-canvas-shape-select">
              <span>{t("diagram.changeShape")}</span>
              <select
                onChange={(event) => changeSelectedNodeShape(event.currentTarget.value as RelicFreeDrawingShapeType)}
                value={selectedEditableNode.shape}
              >
                {relicFreeDrawingShapeTypes.filter((shape) => shape !== "area").map((shape) => (
                  <option key={shape} value={shape}>{t(`diagram.freeDrawingShape.${shape}`)}</option>
                ))}
              </select>
            </label>
          ) : null}
          <button onClick={deleteSelection} type="button">{t("diagram.deleteSelection")}</button>
        </div>
      ) : null}
      {selectedLineLayout ? (
        <div
          className="diagram-canvas-context-toolbar diagram-canvas-context-toolbar--line"
          aria-label={t("diagram.lineToolbar")}
          style={lineContextToolbarStyle}
        >
          <button onClick={() => beginLabelEdit(selectedLineLayout)} type="button">
            {selectedLineLayout.line.label ? t("diagram.editLineLabel") : t("diagram.addLineLabel")}
          </button>
          <button onPointerDown={(event) => reverseSelectedLineDirection(selectedLineLayout, event)} type="button">{t("diagram.reverseLineDirection")}</button>
          <button onPointerDown={(event) => startLineRetarget(selectedLineLayout, "from", event)} type="button">{t("diagram.retargetLineFrom")}</button>
          <button onPointerDown={(event) => startLineRetarget(selectedLineLayout, "to", event)} type="button">{t("diagram.retargetLineTo")}</button>
          <button onClick={deleteSelection} type="button">{t("diagram.deleteSelection")}</button>
        </div>
      ) : null}
      {notice ? (
        <output className="diagram-canvas-notice">{notice}</output>
      ) : null}
      {layout.nodes.length === 0 ? (
        <div className="diagram-canvas-empty-panel">
          <h2>{t("diagram.emptyStartTitle")}</h2>
          <p>{t("diagram.emptyStartDescription")}</p>
          {onChange ? (
            <div className="diagram-canvas-empty-actions">
              <button className="primary-button" onClick={() => setEmptyShapeMenuOpen((current) => !current)} type="button">
                {t("diagram.emptyAddShape")}
              </button>
              {emptyShapeMenuOpen ? (
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
              ) : null}
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
        <DiagramLineLayer
          height={layout.height}
          lines={displayLines}
          onLineDoubleClick={startLabelEditFromLine}
          onLinePointerDown={selectLine}
          previewLine={previewLine}
          selection={selection}
          width={layout.width}
        />
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
                  left: line.labelX,
                  top: line.labelY,
                  zIndex: line.displayLayer
                }}
              >
                {isSelectedLine ? (
                  <span className={`diagram-canvas-line-label${line.label ? "" : " diagram-canvas-line-label--empty"}`}>
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
          {displayNodes.map(({ node, x, y }) => {
            const shapeOptions = isFreeDrawing && "shape" in node ? connectedShapeOptionsForNode(node, diagram.lines, diagram.nodes, freeDrawingShapeOptions) : [];
            const canAddConnectedShape = shapeOptions.length > 0;

            return (
              <DiagramNodeView
                isDragging={drag?.nodeId === node.id}
                isTextEditing={nodeTextEdit?.nodeId === node.id}
                isSelected={(selection?.type === "node" && selection.id === node.id) || selectedNodeIds.has(node.id)}
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
                onOutlinePointerDown={startNodeOutlineConnect}
                addShapeLabel={canAddConnectedShape ? t("diagram.addConnectedShape") : undefined}
                addShapeMenuLabel={isFreeDrawing && shapeAddMenu?.nodeId === node.id ? t("diagram.connectedShapeMenu") : undefined}
                addShapeOptions={shapeAddMenu?.nodeId === node.id ? shapeOptions : undefined}
                onShapeAddButtonPointerDown={toggleShapeAddMenu}
                onShapeOptionPointerDown={chooseConnectedShape}
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
            );
          })}
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
                height: node.height,
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
                      value={nodeTextEdit.value}
                    />
                  ) : (
                    <span className={[
                      "diagram-canvas-node-name",
                      "diagram-canvas-node-name--free-text",
                      isArea ? "diagram-canvas-node-name--area-name" : ""
                    ].filter(Boolean).join(" ")}
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

function connectedShapeOptionsForNode(
  node: RelicConnectedDiagramNode,
  lines: RelicDiagramLine[],
  nodes: RelicConnectedDiagramNode[],
  options: ReadonlyArray<{ label: string; shape: RelicFreeDrawingShapeType }>
): ReadonlyArray<{ label: string; shape: RelicFreeDrawingShapeType }> {
  if (canAddDecisionOutputLine(node, lines, nodes)) return options;

  return [];
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

function floatingToolbarStyleForNodes(
  nodes: Array<{ node: RelicConnectedDiagramNode; x: number; y: number }>,
  viewport: ViewportState
): CSSProperties {
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + node.node.width));

  return {
    left: viewport.panX + ((left + right) / 2) * viewport.zoom,
    top: Math.max(62, viewport.panY + top * viewport.zoom - 48)
  };
}

function floatingToolbarStyleForLine(
  line: DiagramCanvasLineLayout,
  viewport: ViewportState
): CSSProperties {
  return {
    left: viewport.panX + ((line.x1 + line.x2) / 2) * viewport.zoom,
    top: Math.max(62, viewport.panY + ((line.y1 + line.y2) / 2) * viewport.zoom - 48)
  };
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
