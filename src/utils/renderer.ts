import rough from "roughjs";
import type { WhiteboardElement } from "../types/elements";
import type { Viewport } from "../types/viewport";
import { DEFAULT_VIEWPORT } from "../types/viewport";
import { applyViewportTransform } from "./coordinates";
import { getFreehandOutline, getSvgPathFromStroke } from "./freehand";
import {
  createRoughRect,
  createRoughEllipse,
  createRoughLine,
  createRoughArrow,
  createRoughLinearPath,
} from "./roughHelpers";
import { drawMindMapNode, drawMindMapEdge } from "./mindmapRenderer";
import {
  getCacheCanvas,
  isCacheValid,
  updateCacheHashes,
  hashElements,
  hashViewport,
} from "./renderCache";

/**
 * Render all non-deleted elements onto the given canvas context.
 * Elements are drawn in zIndex order.
 */
export function renderScene(
  canvas: HTMLCanvasElement,
  elements: WhiteboardElement[],
  selectedElementIds?: string[],
  viewport: Viewport = DEFAULT_VIEWPORT
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const eHash = hashElements(elements);
  const vHash = hashViewport(viewport);

  // Use cached render if nothing changed
  if (isCacheValid(eHash, vHash)) {
    try {
      const cache = getCacheCanvas(canvas.width, canvas.height);
      if (cache) {
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.drawImage(cache, 0, 0, canvas.width / dpr, canvas.height / dpr);
        return;
      }
    } catch { /* fallthrough to full render */ }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  // Apply viewport transform (pan + zoom) in CSS-pixel space
  applyViewportTransform(ctx, viewport);

  // Sort by zIndex for correct layering (skip hidden elements)
  const sorted = [...elements]
    .filter((el) => !el.isDeleted && !el.isHidden)
    .sort((a, b) => a.zIndex - b.zIndex);

  // Separate pixel-eraser elements from normal elements
  const normalElements = sorted.filter((el) => el.type !== "pixel-eraser");
  const pixelErasers = sorted.filter((el) => el.type === "pixel-eraser");

  const rc = rough.canvas(canvas);

  // 1. Render all normal elements
  for (const el of normalElements) {
    ctx.globalAlpha = el.style.opacity;
    renderElement(ctx, rc, el, elements, selectedElementIds || []);
    ctx.globalAlpha = 1;
  }

  // 2. Render pixel-eraser elements with destination-out
  if (pixelErasers.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    for (const el of pixelErasers) {
      if (el.type === "pixel-eraser") {
        renderPixelEraser(ctx, el);
      }
    }
    ctx.restore();
  }

  ctx.restore();

  // Cache the rendered result
  try {
    const cache = getCacheCanvas(canvas.width, canvas.height);
    if (cache) {
      const cacheCtx = cache.getContext("2d");
      if (cacheCtx) {
        cacheCtx.clearRect(0, 0, cache.width, cache.height);
        cacheCtx.drawImage(canvas, 0, 0);
        updateCacheHashes(eHash, vHash);
      }
    }
  } catch { /* OffscreenCanvas not supported, skip */ }
}

/**
 * Render a single element onto the given canvas context.
 */
export function renderSingleElement(
  canvas: HTMLCanvasElement,
  element: WhiteboardElement,
  viewport: Viewport = DEFAULT_VIEWPORT
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rc = rough.canvas(canvas);
  ctx.save();
  applyViewportTransform(ctx, viewport);
  ctx.globalAlpha = element.style.opacity;
  renderElement(ctx, rc, element, [], []);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function renderElement(
  ctx: CanvasRenderingContext2D,
  rc: ReturnType<typeof rough.canvas>,
  el: WhiteboardElement,
  allElements: WhiteboardElement[],
  selectedElementIds: string[]
): void {
  const rotation = el.rotation || 0;
  if (rotation !== 0) {
    // Calculate element center for rotation pivot
    const bounds = getElementCenter(el);
    ctx.save();
    ctx.translate(bounds.cx, bounds.cy);
    ctx.rotate(rotation);
    ctx.translate(-bounds.cx, -bounds.cy);
  }

  switch (el.type) {
    case "pen":
      renderPen(ctx, rc, el);
      break;
    case "rectangle":
      renderRoughShape(rc, el, () =>
        createRoughRect(el.x, el.y, el.width, el.height, el.style, el.roughSeed)
      );
      break;
    case "ellipse":
      renderRoughShape(rc, el, () =>
        createRoughEllipse(
          el.x + el.width / 2,
          el.y + el.height / 2,
          el.width,
          el.height,
          el.style,
          el.roughSeed
        )
      );
      break;
    case "line":
      renderRoughShape(rc, el, () => {
        const [[x1, y1], [x2, y2]] = el.points;
        return createRoughLine(x1, y1, x2, y2, el.style, el.roughSeed);
      });
      break;
    case "arrow":
      renderRoughArrow(rc, el);
      break;
    case "text":
      renderText(ctx, rc, el);
      break;
    case "image":
      renderImage(ctx, el);
      break;
    case "mindmap-node": {
      const hasChildren = allElements.some(
        (e) => e.type === "mindmap-node" && !e.isDeleted && e.parentId === el.id
      );
      drawMindMapNode(ctx, rc, el, selectedElementIds.includes(el.id), hasChildren);
      break;
    }
    case "mindmap-edge":
      drawMindMapEdge(ctx, rc, el, allElements);
      break;
    case "group": {
      // Groups are invisible unless selected — draw subtle dashed border when selected
      if (selectedElementIds.includes(el.id)) {
        ctx.save();
        ctx.strokeStyle = "rgba(74, 144, 217, 0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(el.x, el.y, el.width, el.height);
        ctx.setLineDash([]);
        ctx.restore();
      }
      break;
    }
  }

  if (rotation !== 0) {
    ctx.restore();
  }
}

/** Get center of element for rotation pivot */
function getElementCenter(el: WhiteboardElement): { cx: number; cy: number } {
  const t = el.type as string;
  if ("points" in el && el.points && t !== "rectangle" && t !== "ellipse") {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of el.points) {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }
  return { cx: el.x + el.width / 2, cy: el.y + el.height / 2 };
}

function renderPen(
  ctx: CanvasRenderingContext2D,
  rc: ReturnType<typeof rough.canvas>,
  el: WhiteboardElement & { type: "pen" }
): void {
  if (el.points.length < 2) return;

  if (el.highlighter) {
    // Highlighter: wide, flat, semi-transparent line
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = el.style.strokeColor;
    ctx.lineWidth = el.style.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = el.style.opacity;
    ctx.beginPath();
    ctx.moveTo(el.points[0][0], el.points[0][1]);
    for (let i = 1; i < el.points.length; i++) {
      ctx.lineTo(el.points[i][0], el.points[i][1]);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (el.lineStyle === "sketchy") {
    // During live drawing: render a smooth preview line (no roughjs)
    // This prevents jitter from roughjs re-randomizing the whole stroke
    if ((el as any)._isLiveDrawing) {
      ctx.save();
      ctx.strokeStyle = el.style.strokeColor;
      ctx.lineWidth = el.style.strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(el.points[0][0], el.points[0][1]);
      for (let i = 1; i < el.points.length; i++) {
        ctx.lineTo(el.points[i][0], el.points[i][1]);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Committed stroke: render with rough.js
    if (!el._roughDrawable) {
      el._roughDrawable = createRoughLinearPath(el.points, el.style, el.roughSeed);
    }
    rc.draw(el._roughDrawable as import("roughjs/bin/core").Drawable);
    return;
  }

  // Default: perfect-freehand smooth stroke
  const outline = getFreehandOutline(el.points, el.style.strokeWidth);
  const pathData = getSvgPathFromStroke(outline);
  if (!pathData) return;

  const path = new Path2D(pathData);
  ctx.fillStyle = el.style.strokeColor;
  ctx.fill(path);
}

function renderRoughShape(
  rc: ReturnType<typeof rough.canvas>,
  el: WhiteboardElement,
  createDrawable: () => import("roughjs/bin/core").Drawable
): void {
  if (!el._roughDrawable) {
    el._roughDrawable = createDrawable();
  }
  rc.draw(el._roughDrawable as import("roughjs/bin/core").Drawable);
}

function renderRoughArrow(
  rc: ReturnType<typeof rough.canvas>,
  el: WhiteboardElement & { type: "arrow" }
): void {
  if (!el._roughDrawable) {
    const [[x1, y1], [x2, y2]] = el.points;
    el._roughDrawable = createRoughArrow(x1, y1, x2, y2, el.style, el.roughSeed);
  }
  const drawables = el._roughDrawable as import("roughjs/bin/core").Drawable[];
  for (const d of drawables) {
    rc.draw(d);
  }
}

function renderText(
  ctx: CanvasRenderingContext2D,
  rc: ReturnType<typeof rough.canvas>,
  el: WhiteboardElement & { type: "text" }
): void {
  const pad = el.fontSize * 0.4;

  // Draw rough.js border when showBorder is enabled
  if (el.showBorder) {
    if (!el._roughDrawable) {
      el._roughDrawable = createRoughRect(
        el.x - pad,
        el.y - pad,
        el.width + pad * 2,
        el.height + pad * 2,
        el.style,
        el.roughSeed
      );
    }
    rc.draw(el._roughDrawable as import("roughjs/bin/core").Drawable);
  }

  // Draw text content
  ctx.font = `${el.fontSize}px ${el.fontFamily}`;
  ctx.fillStyle = el.fontColor || el.style.strokeColor;
  ctx.textBaseline = "top";

  const lines = el.textContent.split("\n");
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], el.x, el.y + i * el.fontSize * 1.2);
  }
}

// Image cache to avoid re-decoding
const imageCache = new Map<string, HTMLImageElement>();

export function cacheImage(id: string, img: HTMLImageElement) {
  imageCache.set(id, img);
}

function renderImage(ctx: CanvasRenderingContext2D, el: WhiteboardElement & { type: "image" }): void {
  let img = imageCache.get(el.id);
  if (!img) {
    img = new Image();
    img.src = el.imageDataUrl;
    imageCache.set(el.id, img);
  }
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, el.x, el.y, el.width, el.height);
  } else {
    const canvas = ctx.canvas;
    img.onload = () => {
      const c = canvas.getContext("2d");
      if (c) {
        c.drawImage(img!, el.x, el.y, el.width, el.height);
      }
    };
  }
}

function renderPixelEraser(ctx: CanvasRenderingContext2D, el: WhiteboardElement & { type: "pixel-eraser" }): void {
  if (el.points.length < 1) return;

  if (el.points.length === 1) {
    // Single point — draw a circle
    ctx.beginPath();
    ctx.arc(el.points[0][0], el.points[0][1], el.eraserSize / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Draw continuous stroke through all points
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = el.eraserSize;
  ctx.beginPath();
  ctx.moveTo(el.points[0][0], el.points[0][1]);
  for (let i = 1; i < el.points.length; i++) {
    ctx.lineTo(el.points[i][0], el.points[i][1]);
  }
  ctx.stroke();
}
