import type { WhiteboardElement, MindMapNodeElement } from "../types/elements";
import { distToSegment } from "./geometry";
import { estimateNodeSize } from "./mindmapHelpers";

const HIT_TOLERANCE = 8;

/**
 * Find the topmost element at the given point.
 * Returns null if no element is hit.
 */
export function hitTest(
  x: number,
  y: number,
  elements: WhiteboardElement[]
): WhiteboardElement | null {
  // Iterate in reverse zIndex order (topmost first), skip hidden/locked
  const sorted = [...elements]
    .filter((el) => !el.isDeleted && !el.isHidden && !el.locked)
    .sort((a, b) => b.zIndex - a.zIndex);

  for (const el of sorted) {
    if (hitTestElement(x, y, el)) {
      return el;
    }
  }
  return null;
}

function hitTestElement(x: number, y: number, el: WhiteboardElement): boolean {
  // Transform click point into element's local (unrotated) coordinate system
  const rotation = el.rotation || 0;
  if (rotation !== 0) {
    const bounds = getElementCenter(el);
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const dx = x - bounds.cx;
    const dy = y - bounds.cy;
    x = bounds.cx + dx * cos - dy * sin;
    y = bounds.cy + dx * sin + dy * cos;
  }

  switch (el.type) {
    case "rectangle":
    case "text":
    case "image":
      return hitTestAABB(x, y, el.x, el.y, el.width, el.height);

    case "ellipse":
      return hitTestEllipse(
        x,
        y,
        el.x + el.width / 2,
        el.y + el.height / 2,
        el.width / 2,
        el.height / 2
      );

    case "line":
    case "arrow": {
      const [[x1, y1], [x2, y2]] = el.points;
      return (
        distToSegment(x, y, x1, y1, x2, y2) <
        el.style.strokeWidth / 2 + HIT_TOLERANCE
      );
    }

    case "pen":
      return hitTestPen(x, y, el);

    case "mindmap-node":
      return hitTestMindMapNode(x, y, el);

    case "mindmap-edge":
      return false; // edges are not directly clickable

    case "group":
      return hitTestAABB(x, y, el.x, el.y, el.width, el.height);

    default:
      return false;
  }
}

function hitTestAABB(
  px: number,
  py: number,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  // Normalize for negative width/height
  const minX = Math.min(x, x + w);
  const maxX = Math.max(x, x + w);
  const minY = Math.min(y, y + h);
  const maxY = Math.max(y, y + h);
  return (
    px >= minX - HIT_TOLERANCE &&
    px <= maxX + HIT_TOLERANCE &&
    py >= minY - HIT_TOLERANCE &&
    py <= maxY + HIT_TOLERANCE
  );
}

function hitTestEllipse(
  px: number,
  py: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number
): boolean {
  if (rx === 0 || ry === 0) return false;
  const dx = px - cx;
  const dy = py - cy;
  const rxT = rx + HIT_TOLERANCE;
  const ryT = ry + HIT_TOLERANCE;
  return (dx * dx) / (rxT * rxT) + (dy * dy) / (ryT * ryT) <= 1;
}

function hitTestPen(
  px: number,
  py: number,
  el: WhiteboardElement & { type: "pen" }
): boolean {
  // First check bounding box
  if (el.points.length === 0) return false;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of el.points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (
    px < minX - HIT_TOLERANCE ||
    px > maxX + HIT_TOLERANCE ||
    py < minY - HIT_TOLERANCE ||
    py > maxY + HIT_TOLERANCE
  ) {
    return false;
  }

  // Then check each segment
  const tolerance = el.style.strokeWidth * 1.5 + HIT_TOLERANCE;
  for (let i = 0; i < el.points.length - 1; i++) {
    const [x1, y1] = el.points[i];
    const [x2, y2] = el.points[i + 1];
    if (distToSegment(px, py, x1, y1, x2, y2) < tolerance) {
      return true;
    }
  }
  return false;
}

function hitTestMindMapNode(
  px: number,
  py: number,
  el: WhiteboardElement & { type: "mindmap-node" }
): boolean {
  const { width: w, height: h } = estimateNodeSize(el as MindMapNodeElement);

  return (
    px >= el.x - HIT_TOLERANCE &&
    px <= el.x + w + HIT_TOLERANCE &&
    py >= el.y - HIT_TOLERANCE &&
    py <= el.y + h + HIT_TOLERANCE
  );
}

/** Get center of element for rotation pivot */
function getElementCenter(el: WhiteboardElement): { cx: number; cy: number } {
  if ("points" in el && el.points && (el.type as string) !== "rectangle" && (el.type as string) !== "ellipse") {
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
