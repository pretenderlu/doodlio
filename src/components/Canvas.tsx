import { useRef, useCallback, useState, useEffect } from "react";
import { useCanvas } from "../hooks/useCanvas";
import { useWhiteboard } from "../hooks/useElements";
import { useTextEditor } from "../hooks/useTextEditor";
import { useImageInsert } from "../hooks/useImageInsert";
import { useMindMap } from "../hooks/useMindMap";
import { hitTest } from "../utils/hitTest";
import { screenToWorld } from "../utils/coordinates";
import { MIN_ZOOM, MAX_ZOOM } from "../types/viewport";

interface PinchState {
  initialDist: number;
  initialZoom: number;
  centerX: number;
  centerY: number;
}

const LASER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='5' fill='%23e03131' opacity='0.9'/%3E%3Ccircle cx='12' cy='12' r='10' fill='%23e03131' opacity='0.2'/%3E%3C/svg%3E") 12 12, crosshair`;

const TOOL_CURSORS: Record<string, string> = {
  select: "default",
  pen: "crosshair",
  highlighter: "crosshair",
  laser: LASER_CURSOR,
  line: "crosshair",
  rectangle: "crosshair",
  ellipse: "crosshair",
  arrow: "crosshair",
  text: "text",
  eraser: "crosshair",
  image: "default",
  mindmap: "default",
  hand: "grab",
};

interface CanvasProps {
  aspectRatio: string;
  canvasBg?: string;
  laserCanvas?: React.RefObject<HTMLCanvasElement | null>;
}

export function Canvas({ aspectRatio, canvasBg = "#ffffff", laserCanvas }: CanvasProps) {
  const staticCanvas = useRef<HTMLCanvasElement>(null);
  const dynamicCanvas = useRef<HTMLCanvasElement>(null);
  const { state, resetViewport, zoomTo } = useWhiteboard();
  const { startEditing, startEditingExisting, textEditorUI } = useTextEditor();
  const { handleDrop, handleDragOver } = useImageInsert();

  const { handlePointerDown, handlePointerMove, handlePointerUp, getResizeCursor, getIsPanning, handleWheel } = useCanvas({
    staticCanvas,
    dynamicCanvas,
    laserCanvas,
  });

  const mindMap = useMindMap(dynamicCanvas);

  const [resizeCursor, setResizeCursor] = useState<string | null>(null);

  // Attach wheel listener with passive:false for zoom
  useEffect(() => {
    const canvas = dynamicCanvas.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Pinch-to-zoom for touch devices
  const pinchRef = useRef<PinchState | null>(null);
  useEffect(() => {
    const canvas = dynamicCanvas.current;
    if (!canvas) return;

    const getTouchDist = (t: TouchList) => {
      const dx = t[1].clientX - t[0].clientX;
      const dy = t[1].clientY - t[0].clientY;
      return Math.hypot(dx, dy);
    };
    const getTouchCenter = (t: TouchList) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (t[0].clientX + t[1].clientX) / 2 - rect.left,
        y: (t[0].clientY + t[1].clientY) / 2 - rect.top,
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getTouchDist(e.touches);
        const center = getTouchCenter(e.touches);
        pinchRef.current = {
          initialDist: dist,
          initialZoom: state.viewport.zoom,
          centerX: center.x,
          centerY: center.y,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dist = getTouchDist(e.touches);
        const center = getTouchCenter(e.touches);
        const scale = dist / pinchRef.current.initialDist;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.initialZoom * scale));
        zoomTo(newZoom, center.x, center.y);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchRef.current = null;
      }
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [state.viewport.zoom, zoomTo]);

  const baseCursor = state.activeTool === "eraser" && state.eraserMode === "pixel"
    ? "none"
    : (TOOL_CURSORS[state.activeTool] || "default");

  const panCursor = getIsPanning() ? "grabbing" : (state.activeTool === "hand" ? "grab" : null);
  const cursor = panCursor || resizeCursor || baseCursor;

  const getCanvasPoint = useCallback(
    (e: React.PointerEvent | React.MouseEvent): [number, number] => {
      const canvas = dynamicCanvas.current;
      if (!canvas) return [0, 0];
      const rect = canvas.getBoundingClientRect();
      return screenToWorld(e.clientX - rect.left, e.clientY - rect.top, state.viewport);
    },
    [dynamicCanvas, state.viewport]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (state.activeTool === "text") {
        const [wx, wy] = getCanvasPoint(e);
        startEditing(wx, wy);
        return;
      }
      // Let mindmap hook handle if active
      if (mindMap.handlePointerDown(e, getCanvasPoint as (e: React.PointerEvent) => [number, number])) return;
      handlePointerDown(e);
    },
    [state.activeTool, handlePointerDown, startEditing, mindMap, getCanvasPoint]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      setResizeCursor(getResizeCursor(e));
      if (mindMap.handlePointerMove(e, getCanvasPoint as (e: React.PointerEvent) => [number, number])) return;
      handlePointerMove(e);
    },
    [handlePointerMove, getResizeCursor, mindMap, getCanvasPoint]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (mindMap.handlePointerUp(e, getCanvasPoint as (e: React.PointerEvent) => [number, number])) return;
      handlePointerUp(e);
    },
    [handlePointerUp, mindMap, getCanvasPoint]
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // In select mode, double-click on text element to edit it
      if (state.activeTool === "select") {
        const [x, y] = getCanvasPoint(e);
        const hit = hitTest(x, y, state.elements);
        if (hit && hit.type === "text") {
          startEditingExisting(hit.id);
          return;
        }
      }
      mindMap.handleDoubleClick(e, getCanvasPoint as (e: React.PointerEvent | React.MouseEvent) => [number, number]);
    },
    [state.activeTool, state.elements, mindMap, getCanvasPoint, startEditingExisting]
  );

  const zoomPercent = Math.round(state.viewport.zoom * 100);

  return (
    <div className="canvas-outer" onDrop={handleDrop} onDragOver={handleDragOver}>
      <div className="canvas-frame" style={{ aspectRatio, background: canvasBg }}>
        <canvas
          ref={staticCanvas}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        />
        <canvas
          ref={dynamicCanvas}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            cursor,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDoubleClick}
        />
        {textEditorUI}
        {mindMap.nodeEditorUI}
        {/* Zoom indicator */}
        <div className="zoom-indicator">
          <button
            className="zoom-btn"
            onClick={() => {
              const canvas = dynamicCanvas.current;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              zoomTo(Math.max(MIN_ZOOM, state.viewport.zoom / 1.2), rect.width / 2, rect.height / 2);
            }}
            title="缩小"
          >
            −
          </button>
          <span className="zoom-text">{zoomPercent}%</span>
          <button
            className="zoom-btn"
            onClick={() => {
              const canvas = dynamicCanvas.current;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              zoomTo(Math.min(MAX_ZOOM, state.viewport.zoom * 1.2), rect.width / 2, rect.height / 2);
            }}
            title="放大"
          >
            +
          </button>
          {zoomPercent !== 100 && (
            <button className="zoom-reset-btn" onClick={resetViewport} title="重置缩放">
              重置
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
