export type DiagramRenderHandle = {
  fitToViewport: () => void;
};

const diagramZoomMin = 0.4;
const diagramZoomMax = 4;
const diagramZoomFactor = 1.12;
const diagramKeyboardPanStep = 48;
const diagramKeyboardLargePanStep = 144;

export function initializeDiagramPanZoom(viewport: HTMLElement, content: HTMLElement): DiagramRenderHandle {
  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginX = 0;
  let dragOriginY = 0;
  let activePointerId: number | null = null;
  let hasUserTransformed = false;
  let transformFrameId: number | null = null;

  const applyTransform = () => {
    content.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
  };

  const updateTransformNow = () => {
    if (transformFrameId !== null) {
      window.cancelAnimationFrame(transformFrameId);
      transformFrameId = null;
    }
    applyTransform();
  };

  const scheduleTransformUpdate = () => {
    if (transformFrameId !== null) return;

    transformFrameId = window.requestAnimationFrame(() => {
      transformFrameId = null;
      applyTransform();
    });
  };

  const fitToViewport = () => {
    const padding = 24;
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const contentRect = content.getBoundingClientRect();
    const contentWidth = content.scrollWidth || contentRect.width;
    const contentHeight = content.scrollHeight || contentRect.height;

    if (viewportWidth <= 0 || viewportHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) return;

    const availableWidth = viewportWidth - padding * 2;
    const availableHeight = viewportHeight - padding * 2;
    if (availableWidth <= 0 || availableHeight <= 0) return;

    const fitZoom = Math.round(Math.min(
      diagramZoomMax,
      Math.max(
        diagramZoomMin,
        Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1)
      )
    ) * 100) / 100;

    zoom = fitZoom;
    offsetX = Math.round(((viewportWidth - contentWidth * fitZoom) / 2) * 100) / 100;
    offsetY = Math.round(((viewportHeight - contentHeight * fitZoom) / 2) * 100) / 100;
    hasUserTransformed = false;
    updateTransformNow();
  };

  const applyZoom = (nextZoom: number, anchor?: { clientX: number; clientY: number }) => {
    const previousZoom = zoom;
    const clampedZoom = Math.round(Math.min(diagramZoomMax, Math.max(diagramZoomMin, nextZoom)) * 100) / 100;

    if (anchor && clampedZoom !== previousZoom) {
      const rect = viewport.getBoundingClientRect();
      const mouseX = anchor.clientX - rect.left;
      const mouseY = anchor.clientY - rect.top;
      const contentX = (mouseX - offsetX) / previousZoom;
      const contentY = (mouseY - offsetY) / previousZoom;
      offsetX = Math.round((mouseX - contentX * clampedZoom) * 100) / 100;
      offsetY = Math.round((mouseY - contentY * clampedZoom) * 100) / 100;
    }

    zoom = clampedZoom;
    hasUserTransformed = true;
    scheduleTransformUpdate();
  };

  const panBy = (deltaX: number, deltaY: number) => {
    offsetX = Math.round((offsetX + deltaX) * 100) / 100;
    offsetY = Math.round((offsetY + deltaY) * 100) / 100;
    hasUserTransformed = true;
    scheduleTransformUpdate();
  };

  const getViewportCenter = () => {
    const rect = viewport.getBoundingClientRect();
    return {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };
  };

  const resizeObserver = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => {
        if (hasUserTransformed) return;

        window.requestAnimationFrame(() => {
          if (!hasUserTransformed && viewport.isConnected) fitToViewport();
        });
      })
    : null;

  resizeObserver?.observe(viewport);

  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    event.stopPropagation();
    applyZoom(event.deltaY < 0 ? zoom * diagramZoomFactor : zoom / diagramZoomFactor, event);
  });
  viewport.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  viewport.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    isDragging = true;
    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragOriginX = offsetX;
    dragOriginY = offsetY;
    viewport.classList.add("preview-diagram-panzoom-viewport--dragging");
    viewport.setPointerCapture?.(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!isDragging) return;

    event.preventDefault();
    event.stopPropagation();
    offsetX = dragOriginX + event.clientX - dragStartX;
    offsetY = dragOriginY + event.clientY - dragStartY;
    hasUserTransformed = true;
    scheduleTransformUpdate();
  });
  viewport.addEventListener("pointerup", (event) => {
    event.preventDefault();
    event.stopPropagation();
    stopDragging(event.pointerId);
  });
  viewport.addEventListener("pointercancel", (event) => {
    event.preventDefault();
    event.stopPropagation();
    stopDragging(event.pointerId);
  });
  viewport.addEventListener("dragstart", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  viewport.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const panStep = event.shiftKey ? diagramKeyboardLargePanStep : diagramKeyboardPanStep;

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      event.stopPropagation();
      applyZoom(zoom * diagramZoomFactor, getViewportCenter());
      return;
    }

    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      event.stopPropagation();
      applyZoom(zoom / diagramZoomFactor, getViewportCenter());
      return;
    }

    if (event.key === "0" || event.key.toLowerCase() === "f") {
      event.preventDefault();
      event.stopPropagation();
      fitToViewport();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      panBy(panStep, 0);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      panBy(-panStep, 0);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      panBy(0, panStep);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      panBy(0, -panStep);
    }
  });
  updateTransformNow();
  window.requestAnimationFrame(() => {
    if (!hasUserTransformed && viewport.isConnected) fitToViewport();
  });
  return { fitToViewport };

  function stopDragging(pointerId: number): void {
    if (!isDragging) return;

    isDragging = false;
    viewport.classList.remove("preview-diagram-panzoom-viewport--dragging");
    releaseActivePointerCapture(pointerId);
    activePointerId = null;
  }

  function releaseActivePointerCapture(fallbackPointerId: number): void {
    const pointerId = activePointerId ?? fallbackPointerId;

    try {
      if (!viewport.hasPointerCapture || viewport.hasPointerCapture(pointerId)) {
        viewport.releasePointerCapture?.(pointerId);
      }
    } catch {
      // Pointer capture may already be gone after pointercancel.
    }
  }
}
