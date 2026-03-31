/**
 * Geometry utility functions
 */

/** Distance from a point to a line segment */
export function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/** Constrain a point for Shift-key behavior */
export function constrainPoint(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  toolType: string
): [number, number] {
  const dx = currentX - startX;
  const dy = currentY - startY;

  if (toolType === "rectangle" || toolType === "ellipse") {
    // square / circle constraint
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    return [
      startX + size * Math.sign(dx || 1),
      startY + size * Math.sign(dy || 1),
    ];
  }

  if (toolType === "line" || toolType === "arrow") {
    // snap to nearest 45-degree angle
    const angle = Math.atan2(dy, dx);
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const dist = Math.hypot(dx, dy);
    return [
      startX + Math.cos(snapped) * dist,
      startY + Math.sin(snapped) * dist,
    ];
  }

  return [currentX, currentY];
}
