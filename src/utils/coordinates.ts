import type { Viewport } from "../types/viewport";

/** Convert screen (CSS) coordinates to world coordinates. */
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: Viewport
): [number, number] {
  return [
    (screenX - viewport.panX) / viewport.zoom,
    (screenY - viewport.panY) / viewport.zoom,
  ];
}

/** Convert world coordinates to screen (CSS) coordinates. */
export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: Viewport
): [number, number] {
  return [
    worldX * viewport.zoom + viewport.panX,
    worldY * viewport.zoom + viewport.panY,
  ];
}

/** Apply viewport transform to a canvas 2D context (call after dpr scaling). */
export function applyViewportTransform(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport
): void {
  ctx.translate(viewport.panX, viewport.panY);
  ctx.scale(viewport.zoom, viewport.zoom);
}
