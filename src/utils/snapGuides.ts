import type { WhiteboardElement } from "../types/elements";

export interface SnapGuide {
  type: "vertical" | "horizontal";
  position: number;
  from: number;
  to: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

const SNAP_THRESHOLD = 5;

export function computeSnap(
  dragBounds: { minX: number; minY: number; maxX: number; maxY: number },
  targets: WhiteboardElement[],
  zoom: number
): SnapResult {
  const threshold = SNAP_THRESHOLD / zoom;
  const guides: SnapGuide[] = [];
  let dx = 0;
  let dy = 0;

  const dragCenterX = (dragBounds.minX + dragBounds.maxX) / 2;
  const dragCenterY = (dragBounds.minY + dragBounds.maxY) / 2;

  const verticalSnaps: number[] = [];
  const horizontalSnaps: number[] = [];
  const targetBounds: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = [];

  for (const el of targets) {
    if (el.isDeleted || el.isHidden) continue;
    const b = getElementBounds(el);
    targetBounds.push(b);
    verticalSnaps.push(b.minX, b.maxX, (b.minX + b.maxX) / 2);
    horizontalSnaps.push(b.minY, b.maxY, (b.minY + b.maxY) / 2);
  }

  // Vertical snaps (x-axis)
  const dragXPoints = [dragBounds.minX, dragBounds.maxX, dragCenterX];
  let bestDx = Infinity;
  for (const dragX of dragXPoints) {
    for (const snapX of verticalSnaps) {
      const diff = snapX - dragX;
      if (Math.abs(diff) < Math.abs(bestDx) && Math.abs(diff) <= threshold) {
        bestDx = diff;
      }
    }
  }
  if (Math.abs(bestDx) <= threshold) {
    dx = bestDx;
    const allMinY = Math.min(dragBounds.minY, ...targetBounds.map((b) => b.minY));
    const allMaxY = Math.max(dragBounds.maxY, ...targetBounds.map((b) => b.maxY));
    for (const dragX of dragXPoints) {
      for (const snapX of verticalSnaps) {
        if (Math.abs(snapX - (dragX + dx)) < 0.5) {
          guides.push({ type: "vertical", position: snapX, from: allMinY, to: allMaxY });
        }
      }
    }
  }

  // Horizontal snaps (y-axis)
  const dragYPoints = [dragBounds.minY, dragBounds.maxY, dragCenterY];
  let bestDy = Infinity;
  for (const dragY of dragYPoints) {
    for (const snapY of horizontalSnaps) {
      const diff = snapY - dragY;
      if (Math.abs(diff) < Math.abs(bestDy) && Math.abs(diff) <= threshold) {
        bestDy = diff;
      }
    }
  }
  if (Math.abs(bestDy) <= threshold) {
    dy = bestDy;
    const allMinX = Math.min(dragBounds.minX + dx, ...targetBounds.map((b) => b.minX));
    const allMaxX = Math.max(dragBounds.maxX + dx, ...targetBounds.map((b) => b.maxX));
    for (const dragY of dragYPoints) {
      for (const snapY of horizontalSnaps) {
        if (Math.abs(snapY - (dragY + dy)) < 0.5) {
          guides.push({ type: "horizontal", position: snapY, from: allMinX, to: allMaxX });
        }
      }
    }
  }

  return { dx, dy, guides: deduplicateGuides(guides) };
}

function getElementBounds(el: WhiteboardElement) {
  if ("points" in el && el.points && (el.type as string) !== "rectangle" && (el.type as string) !== "ellipse") {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of el.points) {
      minX = Math.min(minX, px); minY = Math.min(minY, py);
      maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
    }
    return { minX, minY, maxX, maxY };
  }
  const x1 = Math.min(el.x, el.x + el.width);
  const y1 = Math.min(el.y, el.y + el.height);
  return { minX: x1, minY: y1, maxX: x1 + Math.abs(el.width), maxY: y1 + Math.abs(el.height) };
}

function deduplicateGuides(guides: SnapGuide[]): SnapGuide[] {
  const map = new Map<string, SnapGuide>();
  for (const g of guides) {
    const key = `${g.type}-${g.position.toFixed(1)}`;
    const existing = map.get(key);
    if (existing) {
      existing.from = Math.min(existing.from, g.from);
      existing.to = Math.max(existing.to, g.to);
    } else {
      map.set(key, { ...g });
    }
  }
  return Array.from(map.values());
}
