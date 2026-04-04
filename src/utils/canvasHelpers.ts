import type { WhiteboardElement } from "../types/elements";
import type { SnapGuide } from "./snapGuides";

export const HANDLE_SIZE = 8;
export const SELECTION_PAD = 6;
export const ROTATION_HANDLE_OFFSET = 24;
export const ROTATION_HANDLE_RADIUS = 5;

export function getSelectionBounds(el: WhiteboardElement): { x: number; y: number; w: number; h: number } {
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

export function hitTestHandle(px: number, py: number, el: WhiteboardElement, scale: number = 1): string | null {
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

export function drawSelectionBox(ctx: CanvasRenderingContext2D, el: WhiteboardElement, handleScale: number = 1) {
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

export function getElementBounds(el: WhiteboardElement): {
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

export function drawLaserPointer(
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

export function drawSnapGuides(ctx: CanvasRenderingContext2D, guides: SnapGuide[], zoom: number) {
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

export function drawPixelEraserCursor(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
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
