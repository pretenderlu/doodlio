import { useRef, useEffect, useCallback } from "react";
import { nanoid } from "nanoid";
import { useWhiteboard } from "./useElements";
import { renderScene, renderSingleElement } from "../utils/renderer";
import { hitTest } from "../utils/hitTest";
import { constrainPoint } from "../utils/geometry";
import { screenToWorld, applyViewportTransform } from "../utils/coordinates";
import { computeSnap, type SnapGuide } from "../utils/snapGuides";
import type {
  WhiteboardElement,
  PenElement,
  LineElement,
  RectangleElement,
  EllipseElement,
  ArrowElement,
  PixelEraserElement,
} from "../types/elements";

interface CanvasRefs {
  staticCanvas: React.RefObject<HTMLCanvasElement | null>;
  dynamicCanvas: React.RefObject<HTMLCanvasElement | null>;
  /** Separate overlay canvas for laser pointer (high z-index, pointer-events:none) */
  laserCanvas?: React.RefObject<HTMLCanvasElement | null>;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  elementStartPositions: Map<string, { x: number; y: number; w: number; h: number }>;
  handle: string | null; // "nw" | "ne" | "sw" | "se" | "rotate" or null for move
  // For single-element resize
  elementStartX: number;
  elementStartY: number;
  elementStartW: number;
  elementStartH: number;
  // For rotation
  isRotating?: boolean;
  rotationStart?: number; // initial angle in radians
  elementStartRotation?: number;
}

// Selection box drag state
interface MarqueeState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function useCanvas({ staticCanvas, dynamicCanvas, laserCanvas }: CanvasRefs) {
  const { state, dispatch, zoomTo, panBy } = useWhiteboard();
  const currentElement = useRef<WhiteboardElement | null>(null);
  const isDrawing = useRef(false);
  const dragState = useRef<DragState | null>(null);
  const marqueeState = useRef<MarqueeState | null>(null);
  // Eraser state
  const isErasing = useRef(false);
  const erasedIds = useRef<Set<string>>(new Set());
  const eraserAreaStart = useRef<[number, number] | null>(null);
  // Laser state
  const isLasering = useRef(false);
  const laserTrail = useRef<Array<[number, number, number]>>([]); // [x, y, timestamp]
  const laserAnimFrame = useRef<number>(0);
  const laserDurationRef = useRef(state.laserDuration);
  laserDurationRef.current = state.laserDuration;
  // Pan state
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const spaceHeld = useRef(false);
  // Snap guides
  const snapGuides = useRef<SnapGuide[]>([]);
  // Touch/stylus support
  const activePointerId = useRef<number | null>(null);
  const activePointerType = useRef<string | null>(null);

  // Laser animation loop — runs continuously while trail has points
  const startLaserLoop = useCallback(() => {
    if (laserAnimFrame.current) return; // already running
    const tick = () => {
      const dur = laserDurationRef.current;
      const now = Date.now();
      // Prune expired points
      laserTrail.current = laserTrail.current.filter((p) => now - p[2] < dur);
      if (laserTrail.current.length === 0) {
        // Trail fully faded — clear laser canvas and stop loop
        const lc = laserCanvas?.current ?? dynamicCanvas.current;
        if (lc) {
          const ctx = lc.getContext("2d");
          if (ctx) {
            const dpr = window.devicePixelRatio || 1;
            ctx.clearRect(0, 0, lc.width / dpr, lc.height / dpr);
          }
        }
        laserAnimFrame.current = 0;
        return;
      }
      drawLaserPointer(laserCanvas?.current ?? dynamicCanvas.current, laserTrail.current, dur);
      laserAnimFrame.current = requestAnimationFrame(tick);
    };
    laserAnimFrame.current = requestAnimationFrame(tick);
  }, [dynamicCanvas, laserCanvas]);

  // Cleanup laser animation on unmount
  useEffect(() => {
    return () => {
      if (laserAnimFrame.current) cancelAnimationFrame(laserAnimFrame.current);
    };
  }, []);

  // Track Space key for pan mode (skip when mindmap tool is active — space toggles collapse there)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
        if (state.activeTool === "mindmap") return;
        spaceHeld.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeld.current = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [state.activeTool]);

  // Setup Hi-DPI and resize handling
  const setupCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const expectedW = Math.round(rect.width * dpr);
      const expectedH = Math.round(rect.height * dpr);
      // Only set width/height when dimensions actually changed.
      // Setting canvas.width/height ALWAYS clears all content (HTML5 spec),
      // so we must avoid it when only state (not layout) changed.
      if (canvas.width !== expectedW || canvas.height !== expectedH) {
        canvas.width = expectedW;
        canvas.height = expectedH;
      }
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      }
    },
    []
  );

  useEffect(() => {
    const handleResize = () => {
      setupCanvas(staticCanvas.current);
      setupCanvas(dynamicCanvas.current);
      if (staticCanvas.current) {
        renderScene(staticCanvas.current, state.elements, state.selectedElementIds, state.viewport);
      }
    };

    handleResize();

    const observer = new ResizeObserver(() => {
      handleResize();
    });

    if (staticCanvas.current) {
      observer.observe(staticCanvas.current);
    }

    return () => observer.disconnect();
  }, [setupCanvas, staticCanvas, dynamicCanvas, state.elements, state.viewport]);

  // Re-render static canvas when elements or selection change
  useEffect(() => {
    if (staticCanvas.current) {
      renderScene(staticCanvas.current, state.elements, state.selectedElementIds, state.viewport);
    }
  }, [state.elements, state.selectedElementIds, state.viewport, staticCanvas]);

  // Render selection indicators
  useEffect(() => {
    const canvas = dynamicCanvas.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    if (state.selectedElementIds.length > 0 && state.activeTool === "select") {
      ctx.save();
      applyViewportTransform(ctx, state.viewport);
      const handleScale = 1 / state.viewport.zoom;
      for (const selId of state.selectedElementIds) {
        const el = state.elements.find((e) => e.id === selId && !e.isDeleted);
        if (el) {
          drawSelectionBox(ctx, el, handleScale);
        }
      }
      ctx.restore();
    }
  }, [state.selectedElementIds, state.activeTool, state.elements, state.viewport, dynamicCanvas]);

  const getCanvasPoint = useCallback(
    (e: React.PointerEvent): [number, number] => {
      const canvas = dynamicCanvas.current;
      if (!canvas) return [0, 0];
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      return screenToWorld(screenX, screenY, state.viewport);
    },
    [dynamicCanvas, state.viewport]
  );

  /** Get screen-space point (no viewport transform). Used for marquee, laser, etc. */
  const getScreenPoint = useCallback(
    (e: React.PointerEvent | React.MouseEvent): [number, number] => {
      const canvas = dynamicCanvas.current;
      if (!canvas) return [0, 0];
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    },
    [dynamicCanvas]
  );

  const getNextZIndex = useCallback((): number => {
    const maxZ = state.elements.reduce(
      (max, el) => (el.isDeleted ? max : Math.max(max, el.zIndex)),
      0
    );
    return maxZ + 1;
  }, [state.elements]);

  // ---- Pointer handlers ----

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Palm rejection: ignore touch while stylus is active
      if (e.pointerType === "touch" && activePointerType.current === "pen") {
        return;
      }
      if (isDrawing.current && e.pointerId !== activePointerId.current) {
        return;
      }

      activePointerId.current = e.pointerId;
      activePointerType.current = e.pointerType;

      const [x, y] = getCanvasPoint(e);
      const [screenX, screenY] = getScreenPoint(e);
      const tool = state.activeTool;

      // Pan: Space+click, middle-button, or hand tool
      if (spaceHeld.current || e.button === 1 || tool === "hand") {
        isPanning.current = true;
        panStart.current = { x: screenX, y: screenY };
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        return;
      }

      if (tool === "select") {
        // Check if clicking a resize handle on a selected element (single selection only)
        if (state.selectedElementIds.length === 1) {
          const selEl = state.elements.find(
            (e) => e.id === state.selectedElementIds[0] && !e.isDeleted
          );
          if (selEl) {
            const handle = hitTestHandle(x, y, selEl, 1 / state.viewport.zoom);
            if (handle === "rotate" && selEl.type !== "mindmap-node" && selEl.type !== "mindmap-edge" && selEl.type !== "pixel-eraser") {
              // Start rotation drag
              const bounds = getSelectionBounds(selEl);
              const centerX = bounds.x + bounds.w / 2;
              const centerY = bounds.y + bounds.h / 2;
              const startAngle = Math.atan2(y - centerY, x - centerX);
              dragState.current = {
                isDragging: true,
                startX: x,
                startY: y,
                elementStartX: bounds.x,
                elementStartY: bounds.y,
                elementStartW: bounds.w,
                elementStartH: bounds.h,
                elementStartPositions: new Map(),
                handle: "rotate",
                isRotating: true,
                rotationStart: startAngle,
                elementStartRotation: selEl.rotation || 0,
              };
              (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
              return;
            } else if (handle) {
              const bounds = getSelectionBounds(selEl);
              dragState.current = {
                isDragging: true,
                startX: x,
                startY: y,
                elementStartX: bounds.x,
                elementStartY: bounds.y,
                elementStartW: bounds.w,
                elementStartH: bounds.h,
                elementStartPositions: new Map(),
                handle,
              };
              (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
              return;
            }
          }
        }

        const hit = hitTest(x, y, state.elements);
        if (hit) {
          if (e.shiftKey) {
            // Shift+click toggles selection
            dispatch({ type: "TOGGLE_SELECTED", id: hit.id });
          } else if (state.selectedElementIds.includes(hit.id)) {
            // Clicking already-selected element: start drag of all selected
          } else {
            // Click element without shift: single-select
            dispatch({ type: "SET_SELECTED", ids: [hit.id] });
          }

          // Start drag/move for all selected elements
          const selectedIds = e.shiftKey
            ? (state.selectedElementIds.includes(hit.id)
              ? state.selectedElementIds.filter((id) => id !== hit.id)
              : [...state.selectedElementIds, hit.id])
            : (state.selectedElementIds.includes(hit.id)
              ? state.selectedElementIds
              : [hit.id]);

          const startPositions = new Map<string, { x: number; y: number; w: number; h: number }>();
          for (const id of selectedIds) {
            const el = state.elements.find((e) => e.id === id && !e.isDeleted);
            if (el) {
              startPositions.set(id, { x: el.x, y: el.y, w: el.width, h: el.height });
            }
          }

          dragState.current = {
            isDragging: true,
            startX: x,
            startY: y,
            elementStartX: hit.x,
            elementStartY: hit.y,
            elementStartW: hit.width,
            elementStartH: hit.height,
            elementStartPositions: startPositions,
            handle: null,
          };
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        } else {
          if (!e.shiftKey) {
            dispatch({ type: "SET_SELECTED", ids: [] });
          }
          // Start marquee selection (screen-space coordinates)
          marqueeState.current = {
            active: true,
            startX: screenX,
            startY: screenY,
            currentX: screenX,
            currentY: screenY,
          };
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        }
        return;
      }

      if (tool === "eraser") {
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        if (state.eraserMode === "stroke") {
          isErasing.current = true;
          erasedIds.current = new Set();
          const hit = hitTest(x, y, state.elements);
          if (hit) {
            erasedIds.current.add(hit.id);
            dispatch({ type: "DELETE_ELEMENT", id: hit.id });
          }
        } else if (state.eraserMode === "pixel") {
          isErasing.current = true;
          const el: PixelEraserElement = {
            id: nanoid(),
            type: "pixel-eraser",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            points: [[x, y]],
            eraserSize: state.eraserSize,
            style: { ...state.activeStyle },
            roughSeed: 0,
            isDeleted: false,
            zIndex: getNextZIndex(),
          };
          currentElement.current = el;
          const sCanvas = staticCanvas.current;
          if (sCanvas) {
            const sCtx = sCanvas.getContext("2d");
            if (sCtx) {
              sCtx.save();
              applyViewportTransform(sCtx, state.viewport);
              sCtx.globalCompositeOperation = "destination-out";
              sCtx.beginPath();
              sCtx.arc(x, y, state.eraserSize / 2, 0, Math.PI * 2);
              sCtx.fill();
              sCtx.restore();
            }
          }
        } else {
          isErasing.current = true;
          eraserAreaStart.current = [x, y];
        }
        return;
      }

      if (tool === "laser") {
        isLasering.current = true;
        laserTrail.current = [[e.clientX, e.clientY, Date.now()]];
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        startLaserLoop();
        return;
      }

      // Start drawing
      isDrawing.current = true;
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);

      const seed = Math.floor(Math.random() * 2 ** 31);

      switch (tool) {
        case "pen":
        case "highlighter": {
          const isHighlighter = tool === "highlighter";
          const el: PenElement = {
            id: nanoid(),
            type: "pen",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            points: [[x, y, e.pressure || 0.5]],
            style: {
              ...state.activeStyle,
              strokeWidth: isHighlighter ? Math.max(state.activeStyle.strokeWidth * 4, 16) : state.activeStyle.strokeWidth,
              opacity: isHighlighter ? 0.35 : state.activeStyle.opacity,
            },
            roughSeed: seed,
            isDeleted: false,
            zIndex: getNextZIndex(),
            highlighter: isHighlighter,
            lineStyle: isHighlighter ? undefined : state.penLineStyle,
          };
          currentElement.current = el;
          break;
        }
        case "line": {
          const el: LineElement = {
            id: nanoid(),
            type: "line",
            x: x,
            y: y,
            width: 0,
            height: 0,
            points: [
              [x, y],
              [x, y],
            ],
            style: { ...state.activeStyle },
            roughSeed: seed,
            isDeleted: false,
            zIndex: getNextZIndex(),
          };
          currentElement.current = el;
          break;
        }
        case "rectangle": {
          const el: RectangleElement = {
            id: nanoid(),
            type: "rectangle",
            x: x,
            y: y,
            width: 0,
            height: 0,
            style: { ...state.activeStyle },
            roughSeed: seed,
            isDeleted: false,
            zIndex: getNextZIndex(),
          };
          currentElement.current = el;
          break;
        }
        case "ellipse": {
          const el: EllipseElement = {
            id: nanoid(),
            type: "ellipse",
            x: x,
            y: y,
            width: 0,
            height: 0,
            style: { ...state.activeStyle },
            roughSeed: seed,
            isDeleted: false,
            zIndex: getNextZIndex(),
          };
          currentElement.current = el;
          break;
        }
        case "arrow": {
          const el: ArrowElement = {
            id: nanoid(),
            type: "arrow",
            x: x,
            y: y,
            width: 0,
            height: 0,
            points: [
              [x, y],
              [x, y],
            ],
            style: { ...state.activeStyle },
            roughSeed: seed,
            isDeleted: false,
            zIndex: getNextZIndex(),
          };
          currentElement.current = el;
          break;
        }
      }
    },
    [state.activeTool, state.activeStyle, state.elements, state.selectedElementIds, state.eraserMode, state.eraserSize, state.viewport, state.penLineStyle, getCanvasPoint, getScreenPoint, getNextZIndex, startLaserLoop, staticCanvas, dispatch]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Palm rejection: ignore other pointers during active drawing
      if (activePointerId.current !== null && e.pointerId !== activePointerId.current) {
        return;
      }

      const [x, y] = getCanvasPoint(e);
      const [screenX, screenY] = getScreenPoint(e);

      // Handle panning
      if (isPanning.current) {
        const dx = screenX - panStart.current.x;
        const dy = screenY - panStart.current.y;
        panStart.current = { x: screenX, y: screenY };
        panBy(dx, dy);
        return;
      }

      // Handle marquee selection (screen-space)
      if (marqueeState.current?.active) {
        marqueeState.current.currentX = screenX;
        marqueeState.current.currentY = screenY;
        const canvas = dynamicCanvas.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const dpr = window.devicePixelRatio || 1;
            ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
            // Redraw selection boxes in world space
            ctx.save();
            applyViewportTransform(ctx, state.viewport);
            const handleScale = 1 / state.viewport.zoom;
            for (const selId of state.selectedElementIds) {
              const el = state.elements.find((e) => e.id === selId && !e.isDeleted);
              if (el) drawSelectionBox(ctx, el, handleScale);
            }
            ctx.restore();
            // Draw marquee rectangle in screen space
            const ms = marqueeState.current;
            ctx.strokeStyle = "#4a90d9";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.fillStyle = "rgba(74, 144, 217, 0.08)";
            ctx.fillRect(ms.startX, ms.startY, ms.currentX - ms.startX, ms.currentY - ms.startY);
            ctx.strokeRect(ms.startX, ms.startY, ms.currentX - ms.startX, ms.currentY - ms.startY);
            ctx.setLineDash([]);
          }
        }
        return;
      }

      // Handle eraser drag
      if (isErasing.current && state.activeTool === "eraser") {
        const canvas = dynamicCanvas.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;

        if (state.eraserMode === "stroke") {
          const hit = hitTest(x, y, state.elements);
          if (hit && !erasedIds.current.has(hit.id)) {
            erasedIds.current.add(hit.id);
            dispatch({ type: "DELETE_ELEMENT", id: hit.id });
          }
        } else if (state.eraserMode === "pixel" && currentElement.current?.type === "pixel-eraser") {
          const el = currentElement.current as PixelEraserElement;
          const prevPoint = el.points[el.points.length - 1];
          el.points.push([x, y]);

          const sCanvas = staticCanvas.current;
          if (sCanvas) {
            const sCtx = sCanvas.getContext("2d");
            if (sCtx) {
              sCtx.save();
              applyViewportTransform(sCtx, state.viewport);
              sCtx.globalCompositeOperation = "destination-out";
              sCtx.lineCap = "round";
              sCtx.lineJoin = "round";
              sCtx.lineWidth = el.eraserSize;
              sCtx.beginPath();
              sCtx.moveTo(prevPoint[0], prevPoint[1]);
              sCtx.lineTo(x, y);
              sCtx.stroke();
              sCtx.restore();
            }
          }

          ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
          drawPixelEraserCursor(ctx, screenX, screenY, el.eraserSize);
        } else if (eraserAreaStart.current) {
          ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
          const [sx, sy] = eraserAreaStart.current;
          // Area eraser rect drawn in world space
          ctx.save();
          applyViewportTransform(ctx, state.viewport);
          ctx.strokeStyle = "#e03131";
          ctx.lineWidth = 1 / state.viewport.zoom;
          ctx.setLineDash([6 / state.viewport.zoom, 4 / state.viewport.zoom]);
          ctx.fillStyle = "rgba(224, 49, 49, 0.08)";
          ctx.fillRect(sx, sy, x - sx, y - sy);
          ctx.strokeRect(sx, sy, x - sx, y - sy);
          ctx.setLineDash([]);
          ctx.restore();
        }
        return;
      }

      // Show pixel eraser cursor circle on hover (screen space)
      if (state.activeTool === "eraser" && state.eraserMode === "pixel" && !isErasing.current) {
        const canvas = dynamicCanvas.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const dpr = window.devicePixelRatio || 1;
            ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
            drawPixelEraserCursor(ctx, screenX, screenY, state.eraserSize);
          }
        }
      }

      // Handle laser pointer (viewport-absolute coords for fullscreen laser canvas)
      if (isLasering.current) {
        laserTrail.current.push([e.clientX, e.clientY, Date.now()]);
        return;
      }

      // Handle drag/move/resize for selection
      if (dragState.current?.isDragging && state.selectedElementIds.length > 0) {
        const ds = dragState.current;
        const dx = x - ds.startX;
        const dy = y - ds.startY;

        if (ds.handle === "rotate" && ds.isRotating && state.selectedElementIds.length === 1) {
          // Rotation drag
          const el = state.elements.find((e) => e.id === state.selectedElementIds[0]);
          if (!el) return;
          const bounds = getSelectionBounds(el);
          const centerX = bounds.x + bounds.w / 2;
          const centerY = bounds.y + bounds.h / 2;
          const currentAngle = Math.atan2(y - centerY, x - centerX);
          const deltaAngle = currentAngle - (ds.rotationStart || 0);
          let newRotation = (ds.elementStartRotation || 0) + deltaAngle;
          // Snap to 15° increments when holding Shift
          if (e.shiftKey) {
            const snap = Math.PI / 12; // 15 degrees
            newRotation = Math.round(newRotation / snap) * snap;
          }
          dispatch({
            type: "UPDATE_ELEMENT",
            id: el.id,
            updates: { rotation: newRotation } as Partial<WhiteboardElement>,
          });
        } else if (ds.handle && ds.handle !== "rotate" && state.selectedElementIds.length === 1) {
          // Resize single selected element
          const el = state.elements.find((e) => e.id === state.selectedElementIds[0]);
          if (!el) return;

          let newX = ds.elementStartX;
          let newY = ds.elementStartY;
          let newW = ds.elementStartW;
          let newH = ds.elementStartH;

          if (ds.handle.includes("w")) {
            newX = ds.elementStartX + dx;
            newW = ds.elementStartW - dx;
          }
          if (ds.handle.includes("e")) {
            newW = ds.elementStartW + dx;
          }
          if (ds.handle.includes("n")) {
            newY = ds.elementStartY + dy;
            newH = ds.elementStartH - dy;
          }
          if (ds.handle.includes("s")) {
            newH = ds.elementStartH + dy;
          }

          // For images, maintain aspect ratio
          if (el.type === "image" && !e.shiftKey) {
            const aspect = ds.elementStartW / ds.elementStartH;
            if (Math.abs(newW / aspect) > Math.abs(newH)) {
              newH = newW / aspect;
            } else {
              newW = newH * aspect;
            }
            if (ds.handle.includes("w")) {
              newX = ds.elementStartX + ds.elementStartW - newW;
            }
            if (ds.handle.includes("n")) {
              newY = ds.elementStartY + ds.elementStartH - newH;
            }
          }

          if (Math.abs(newW) < 10) newW = newW < 0 ? -10 : 10;
          if (Math.abs(newH) < 10) newH = newH < 0 ? -10 : 10;

          dispatch({
            type: "UPDATE_ELEMENT",
            id: el.id,
            updates: { x: newX, y: newY, width: newW, height: newH } as Partial<WhiteboardElement>,
          });
        } else if (!ds.handle) {
          // Compute snap guides against other (non-selected) elements
          let snapDx = dx, snapDy = dy;
          const selectedSet = new Set(state.selectedElementIds);
          const otherElements = state.elements.filter((el) => !el.isDeleted && !selectedSet.has(el.id));

          // Calculate drag bounds after tentative move
          let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
          for (const [, start] of ds.elementStartPositions) {
            bMinX = Math.min(bMinX, start.x + dx);
            bMinY = Math.min(bMinY, start.y + dy);
            bMaxX = Math.max(bMaxX, start.x + start.w + dx);
            bMaxY = Math.max(bMaxY, start.y + start.h + dy);
          }

          const snap = computeSnap(
            { minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY },
            otherElements,
            state.viewport.zoom
          );
          snapDx = dx + snap.dx;
          snapDy = dy + snap.dy;
          snapGuides.current = snap.guides;

          // Move all selected elements with snap adjustment
          const updates: Array<{ id: string; updates: Partial<WhiteboardElement> }> = [];
          for (const [id, start] of ds.elementStartPositions) {
            updates.push({
              id,
              updates: { x: start.x + snapDx, y: start.y + snapDy } as Partial<WhiteboardElement>,
            });
          }
          if (updates.length > 0) {
            dispatch({ type: "UPDATE_ELEMENTS", updates });
          }

          // Draw snap guides on dynamic canvas
          const guideCanvas = dynamicCanvas.current;
          if (guideCanvas && snap.guides.length > 0) {
            const gCtx = guideCanvas.getContext("2d");
            if (gCtx) {
              const dpr = window.devicePixelRatio || 1;
              gCtx.clearRect(0, 0, guideCanvas.width / dpr, guideCanvas.height / dpr);
              // Redraw selection boxes
              gCtx.save();
              applyViewportTransform(gCtx, state.viewport);
              const handleScale = 1 / state.viewport.zoom;
              for (const selId of state.selectedElementIds) {
                const el = state.elements.find((e) => e.id === selId && !e.isDeleted);
                if (el) drawSelectionBox(gCtx, el, handleScale);
              }
              // Draw snap guide lines
              drawSnapGuides(gCtx, snap.guides, state.viewport.zoom);
              gCtx.restore();
            }
          }
        }
        return;
      }

      if (!isDrawing.current || !currentElement.current) return;

      const canvas = dynamicCanvas.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const el = currentElement.current;

      switch (el.type) {
        case "pen": {
          el.points.push([x, y, e.pressure || 0.5]);
          // For sketchy pens: mark as actively drawing so renderer uses
          // smooth preview instead of roughjs (prevents jitter).
          // roughjs drawable will be created on commit (pointer-up).
          if ((el as PenElement).lineStyle === "sketchy") {
            (el as any)._isLiveDrawing = true;
          }
          break;
        }
        case "line":
        case "arrow": {
          let endX = x,
            endY = y;
          if (e.shiftKey) {
            [endX, endY] = constrainPoint(
              el.points[0][0],
              el.points[0][1],
              x,
              y,
              el.type
            );
          }
          el.points[1] = [endX, endY];
          el._roughDrawable = undefined;
          break;
        }
        case "rectangle":
        case "ellipse": {
          let endX = x,
            endY = y;
          if (e.shiftKey) {
            [endX, endY] = constrainPoint(el.x, el.y, x, y, el.type);
          }
          el.width = endX - el.x;
          el.height = endY - el.y;
          el._roughDrawable = undefined;
          break;
        }
      }

      renderSingleElement(canvas, el, state.viewport);
    },
    [getCanvasPoint, getScreenPoint, state.selectedElementIds, state.elements, state.activeTool, state.eraserMode, state.eraserSize, state.viewport, dynamicCanvas, staticCanvas, dispatch, panBy]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      activePointerId.current = null;
      activePointerType.current = null;
      snapGuides.current = [];

      // End panning
      if (isPanning.current) {
        isPanning.current = false;
        (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
        return;
      }

      // End marquee selection
      if (marqueeState.current?.active) {
        const ms = marqueeState.current;
        marqueeState.current = null;
        (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);

        // Convert screen-space marquee to world coordinates
        const [wMinX, wMinY] = screenToWorld(
          Math.min(ms.startX, ms.currentX),
          Math.min(ms.startY, ms.currentY),
          state.viewport
        );
        const [wMaxX, wMaxY] = screenToWorld(
          Math.max(ms.startX, ms.currentX),
          Math.max(ms.startY, ms.currentY),
          state.viewport
        );

        // Only select if marquee has some size (check in screen space)
        const screenW = Math.abs(ms.currentX - ms.startX);
        const screenH = Math.abs(ms.currentY - ms.startY);
        if (screenW > 3 || screenH > 3) {
          const selectedIds: string[] = [];
          for (const el of state.elements) {
            if (el.isDeleted) continue;
            const bounds = getElementBounds(el);
            if (
              bounds.minX >= wMinX &&
              bounds.maxX <= wMaxX &&
              bounds.minY >= wMinY &&
              bounds.maxY <= wMaxY
            ) {
              selectedIds.push(el.id);
            }
          }
          dispatch({ type: "SET_SELECTED", ids: selectedIds });
        }

        // Clear marquee drawing
        const canvas = dynamicCanvas.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const dpr = window.devicePixelRatio || 1;
            ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
          }
        }
        return;
      }

      // End laser
      if (isLasering.current) {
        isLasering.current = false;
        (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
        return;
      }

      // End eraser
      if (isErasing.current) {
        isErasing.current = false;
        (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);

        if (state.eraserMode === "pixel" && currentElement.current?.type === "pixel-eraser") {
          const el = currentElement.current as PixelEraserElement;
          if (el.points.length >= 2) {
            dispatch({ type: "ADD_ELEMENT", element: { ...el, _roughDrawable: undefined } });
          }
          currentElement.current = null;

          const canvas = dynamicCanvas.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              const dpr = window.devicePixelRatio || 1;
              ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
            }
          }
        } else if (state.eraserMode === "area" && eraserAreaStart.current) {
          const [x, y] = getCanvasPoint(e);
          const [sx, sy] = eraserAreaStart.current;
          const minX = Math.min(sx, x);
          const maxX = Math.max(sx, x);
          const minY = Math.min(sy, y);
          const maxY = Math.max(sy, y);

          const idsToDelete: string[] = [];
          for (const el of state.elements) {
            if (el.isDeleted) continue;
            const bounds = getElementBounds(el);
            if (
              bounds.minX >= minX &&
              bounds.maxX <= maxX &&
              bounds.minY >= minY &&
              bounds.maxY <= maxY
            ) {
              idsToDelete.push(el.id);
            }
          }
          if (idsToDelete.length > 0) {
            dispatch({ type: "DELETE_ELEMENTS", ids: idsToDelete });
          }

          const canvas = dynamicCanvas.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              const dpr = window.devicePixelRatio || 1;
              ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
            }
          }
        }

        eraserAreaStart.current = null;
        erasedIds.current = new Set();
        return;
      }

      // End drag
      if (dragState.current?.isDragging) {
        dragState.current = null;
        (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
        return;
      }

      if (!isDrawing.current || !currentElement.current) return;
      isDrawing.current = false;
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);

      const canvas = dynamicCanvas.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        }
      }

      const el = currentElement.current;

      // Re-apply Shift constraint on commit
      if (e.shiftKey && (el.type === "rectangle" || el.type === "ellipse")) {
        const [endX, endY] = constrainPoint(el.x, el.y, el.x + el.width, el.y + el.height, el.type);
        el.width = endX - el.x;
        el.height = endY - el.y;
      }
      if (e.shiftKey && (el.type === "line" || el.type === "arrow") && el.points.length >= 2) {
        const [endX, endY] = constrainPoint(el.points[0][0], el.points[0][1], el.points[1][0], el.points[1][1], el.type);
        el.points[1] = [endX, endY];
      }

      // Skip tiny accidental elements
      if (el.type === "pen" && el.points.length < 2) {
        currentElement.current = null;
        return;
      }
      if (
        (el.type === "rectangle" || el.type === "ellipse") &&
        Math.abs(el.width) < 2 &&
        Math.abs(el.height) < 2
      ) {
        currentElement.current = null;
        return;
      }

      dispatch({ type: "ADD_ELEMENT", element: { ...el, _roughDrawable: undefined, _isLiveDrawing: undefined } as any });
      currentElement.current = null;
    },
    [dynamicCanvas, getCanvasPoint, state.eraserMode, state.elements, state.viewport, dispatch]
  );

  const getResizeCursor = useCallback(
    (e: React.PointerEvent): string | null => {
      if (state.activeTool !== "select" || state.selectedElementIds.length !== 1) return null;
      if (dragState.current?.isDragging) {
        const h = dragState.current.handle;
        if (h === "nw" || h === "se") return "nwse-resize";
        if (h === "ne" || h === "sw") return "nesw-resize";
        return null;
      }
      const canvas = dynamicCanvas.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const [wx, wy] = screenToWorld(screenX, screenY, state.viewport);
      const selEl = state.elements.find(
        (el) => el.id === state.selectedElementIds[0] && !el.isDeleted
      );
      if (!selEl) return null;
      const handle = hitTestHandle(wx, wy, selEl, 1 / state.viewport.zoom);
      if (handle === "rotate") return "grab";
      if (handle === "nw" || handle === "se") return "nwse-resize";
      if (handle === "ne" || handle === "sw") return "nesw-resize";
      return null;
    },
    [state.activeTool, state.selectedElementIds, state.elements, state.viewport, dynamicCanvas]
  );

  /** Return isPanning for cursor styling */
  const getIsPanning = useCallback(() => isPanning.current || spaceHeld.current || state.activeTool === "hand", [state.activeTool]);

  /** Handle wheel zoom */
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const canvas = dynamicCanvas.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = state.viewport.zoom * zoomFactor;
      zoomTo(newZoom, screenX, screenY);
    },
    [state.viewport.zoom, dynamicCanvas, zoomTo]
  );

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getResizeCursor,
    getIsPanning,
    handleWheel,
  };
}

function getSelectionBounds(el: WhiteboardElement): { x: number; y: number; w: number; h: number } {
  if ("points" in el && el.points && (el.type as string) !== "rectangle" && (el.type as string) !== "ellipse") {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of el.points) {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  return {
    x: Math.min(el.x, el.x + el.width),
    y: Math.min(el.y, el.y + el.height),
    w: Math.abs(el.width),
    h: Math.abs(el.height),
  };
}

const HANDLE_SIZE = 8;
const SELECTION_PAD = 6;
const ROTATION_HANDLE_OFFSET = 24; // distance above the selection box
const ROTATION_HANDLE_RADIUS = 5;

function hitTestHandle(px: number, py: number, el: WhiteboardElement, scale: number = 1): string | null {
  const { x, y, w, h } = getSelectionBounds(el);
  const pad = SELECTION_PAD * scale;
  const hs = HANDLE_SIZE * scale;
  const tolerance = hs / 2 + 4 * scale;

  // Transform point into element's local (unrotated) coordinate system
  let localPx = px;
  let localPy = py;
  const rotation = el.rotation || 0;
  if (rotation !== 0) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const dx = px - cx;
    const dy = py - cy;
    localPx = cx + dx * cos - dy * sin;
    localPy = cy + dx * sin + dy * cos;
  }

  // Check rotation handle (skip for mindmap nodes/edges and pixel erasers)
  if (el.type !== "mindmap-node" && el.type !== "mindmap-edge" && el.type !== "pixel-eraser") {
    const rotCx = x + w / 2;
    const rotCy = y - pad - ROTATION_HANDLE_OFFSET * scale;
    const rotTol = ROTATION_HANDLE_RADIUS * scale + 4 * scale;
    if (Math.abs(localPx - rotCx) <= rotTol && Math.abs(localPy - rotCy) <= rotTol) {
      return "rotate";
    }
  }

  const corners: [number, number, string][] = [
    [x - pad, y - pad, "nw"],
    [x + w + pad, y - pad, "ne"],
    [x - pad, y + h + pad, "sw"],
    [x + w + pad, y + h + pad, "se"],
  ];

  for (const [cx, cy, name] of corners) {
    if (Math.abs(localPx - cx) <= tolerance && Math.abs(localPy - cy) <= tolerance) {
      return name;
    }
  }
  return null;
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, el: WhiteboardElement, handleScale: number = 1) {
  const { x, y, w, h } = getSelectionBounds(el);
  const rotation = el.rotation || 0;

  // Apply rotation around element center
  if (rotation !== 0) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.translate(-cx, -cy);
  }

  const pad = SELECTION_PAD * handleScale;
  ctx.strokeStyle = "#4a90d9";
  ctx.lineWidth = 1 * handleScale;
  ctx.setLineDash([4 * handleScale, 4 * handleScale]);
  ctx.strokeRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
  ctx.setLineDash([]);

  const handleSize = HANDLE_SIZE * handleScale;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#4a90d9";
  ctx.lineWidth = 1.5 * handleScale;
  const corners = [
    [x - pad, y - pad],
    [x + w + pad, y - pad],
    [x - pad, y + h + pad],
    [x + w + pad, y + h + pad],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(
      cx - handleSize / 2,
      cy - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeRect(
      cx - handleSize / 2,
      cy - handleSize / 2,
      handleSize,
      handleSize
    );
  }

  // Rotation handle (skip for mindmap nodes/edges and pixel erasers)
  if (el.type !== "mindmap-node" && el.type !== "mindmap-edge" && el.type !== "pixel-eraser") {
    const topCenterX = x + w / 2;
    const topCenterY = y - pad;
    const rotHandleY = topCenterY - ROTATION_HANDLE_OFFSET * handleScale;
    const rotRadius = ROTATION_HANDLE_RADIUS * handleScale;

    // Connecting line
    ctx.strokeStyle = "#4a90d9";
    ctx.lineWidth = 1 * handleScale;
    ctx.beginPath();
    ctx.moveTo(topCenterX, topCenterY);
    ctx.lineTo(topCenterX, rotHandleY);
    ctx.stroke();

    // Rotation circle
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#4a90d9";
    ctx.lineWidth = 1.5 * handleScale;
    ctx.beginPath();
    ctx.arc(topCenterX, rotHandleY, rotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotation icon (small curved arrow inside)
    ctx.strokeStyle = "#4a90d9";
    ctx.lineWidth = 1.2 * handleScale;
    const iconR = rotRadius * 0.55;
    ctx.beginPath();
    ctx.arc(topCenterX, rotHandleY, iconR, -Math.PI * 0.7, Math.PI * 0.3);
    ctx.stroke();
    // Arrow tip
    const tipX = topCenterX + iconR * Math.cos(Math.PI * 0.3);
    const tipY = rotHandleY + iconR * Math.sin(Math.PI * 0.3);
    ctx.beginPath();
    ctx.moveTo(tipX - 2 * handleScale, tipY - 2.5 * handleScale);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(tipX + 2.5 * handleScale, tipY - 1.5 * handleScale);
    ctx.stroke();
  }

  if (rotation !== 0) {
    ctx.restore();
  }
}

function getElementBounds(el: WhiteboardElement): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (
    "points" in el &&
    el.points &&
    (el.type as string) !== "rectangle" &&
    (el.type as string) !== "ellipse"
  ) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [px, py] of el.points) {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
    return { minX, minY, maxX, maxY };
  }
  const x1 = Math.min(el.x, el.x + el.width);
  const y1 = Math.min(el.y, el.y + el.height);
  return {
    minX: x1,
    minY: y1,
    maxX: x1 + Math.abs(el.width),
    maxY: y1 + Math.abs(el.height),
  };
}

function drawLaserPointer(
  canvas: HTMLCanvasElement | null,
  trail: Array<[number, number, number]>,
  duration: number
) {
  if (!canvas || trail.length === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

  const now = Date.now();
  const [lastX, lastY] = trail[trail.length - 1];

  if (trail.length > 1) {
    // Build living points
    const pts: Array<{ x: number; y: number; life: number }> = [];
    for (let i = 0; i < trail.length; i++) {
      const age = now - trail[i][2];
      const life = 1 - age / duration;
      if (life > 0) {
        pts.push({ x: trail[i][0], y: trail[i][1], life });
      }
    }

    if (pts.length > 1) {

      // Progressive sub-path overlap for natural fade along the path
      // Draw overlapping sub-paths: each starts later along the trail
      // Head end is covered by ALL layers (brightest), tail by fewer (faded)
      const layerCount = 8;
      const baseAlpha = 0.09;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let layer = 0; layer < layerCount; layer++) {
        // Each layer starts at a progressively later point
        const startIdx = Math.floor((layer / layerCount) * (pts.length - 1));
        if (startIdx >= pts.length - 1) continue;

        // Outer glow pass
        ctx.save();
        ctx.lineWidth = 5;
        ctx.strokeStyle = `rgba(230, 40, 40, ${baseAlpha})`;
        ctx.beginPath();
        ctx.moveTo(pts[startIdx].x, pts[startIdx].y);
        for (let i = startIdx + 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();

        // Core pass
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `rgba(240, 50, 50, ${baseAlpha * 1.2})`;
        ctx.beginPath();
        ctx.moveTo(pts[startIdx].x, pts[startIdx].y);
        for (let i = startIdx + 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Laser dot at cursor position
  const lastAge = now - trail[trail.length - 1][2];
  const lastLife = 1 - lastAge / duration;
  if (lastLife > 0) {
    const dotAlpha = Math.min(1, lastLife * 1.5);

    ctx.beginPath();
    ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 40, 40, ${dotAlpha * 0.95})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(lastX, lastY, 10, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(lastX, lastY, 2, lastX, lastY, 10);
    gradient.addColorStop(0, `rgba(255, 60, 60, ${dotAlpha * 0.35})`);
    gradient.addColorStop(1, "rgba(255, 60, 60, 0)");
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

function drawSnapGuides(ctx: CanvasRenderingContext2D, guides: SnapGuide[], zoom: number) {
  ctx.save();
  ctx.strokeStyle = "#e03131";
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([4 / zoom, 4 / zoom]);
  for (const guide of guides) {
    ctx.beginPath();
    if (guide.type === "vertical") {
      ctx.moveTo(guide.position, guide.from - 10 / zoom);
      ctx.lineTo(guide.position, guide.to + 10 / zoom);
    } else {
      ctx.moveTo(guide.from - 10 / zoom, guide.position);
      ctx.lineTo(guide.to + 10 / zoom, guide.position);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPixelEraserCursor(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const r = size / 2;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0, Math.PI * 2);
  ctx.stroke();
}
