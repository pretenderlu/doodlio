import rough from "roughjs";
import type {
  MindMapNodeElement,
  MindMapEdgeElement,
  WhiteboardElement,
} from "../types/elements";

type RoughCanvas = ReturnType<typeof rough.canvas>;

// ---- Constants ----
const NODE_PADDING_X = 14;
const NODE_PADDING_Y = 8;
const NODE_BORDER_RADIUS = 6;
const NODE_MIN_WIDTH = 50;
const COLLAPSE_MARKER_SIZE = 14;

// ---- Color palette by depth ----
const DEPTH_COLORS = [
  "#333333",  // level 0 (root) — dark
  "#4a90d9",  // level 1 — blue
  "#2f9e44",  // level 1 — green
  "#e03131",  // level 1 — red
  "#f08c00",  // level 1 — orange
  "#9c36b5",  // level 1 — purple
];

export function getAutoColor(depth: number, siblingIndex: number): string {
  if (depth === 0) return DEPTH_COLORS[0];
  return DEPTH_COLORS[1 + (siblingIndex % (DEPTH_COLORS.length - 1))];
}

// ---- Measure node size ----
export function measureNode(
  ctx: CanvasRenderingContext2D,
  node: MindMapNodeElement
): { width: number; height: number } {
  const fontFamily = node.fontFamily || "sans-serif";
  ctx.font = `${node.fontSize}px ${fontFamily}`;
  const text = node.textContent || " ";
  const lines = text.split("\n");
  const lineHeight = node.fontSize * 1.3;
  let maxWidth = 0;
  for (const line of lines) {
    maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
  }
  const width = Math.max(NODE_MIN_WIDTH, maxWidth + NODE_PADDING_X * 2);
  const height = lines.length * lineHeight + NODE_PADDING_Y * 2;
  return { width, height };
}

// ---- Build rounded-rect SVG path for rough.js ----
function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const cr = Math.min(r, w / 2, h / 2);
  const right = x + w;
  const bottom = y + h;
  return [
    `M ${x + cr} ${y}`,
    `L ${right - cr} ${y}`,
    `Q ${right} ${y} ${right} ${y + cr}`,
    `L ${right} ${bottom - cr}`,
    `Q ${right} ${bottom} ${right - cr} ${bottom}`,
    `L ${x + cr} ${bottom}`,
    `Q ${x} ${bottom} ${x} ${bottom - cr}`,
    `L ${x} ${y + cr}`,
    `Q ${x} ${y} ${x + cr} ${y}`,
    "Z",
  ].join(" ");
}

// ---- Draw a mind map node (rough.js style) ----
export function drawMindMapNode(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  node: MindMapNodeElement,
  isSelected: boolean,
  hasChildren: boolean
) {
  const text = node.textContent || " ";
  const lines = text.split("\n");
  const lineHeight = node.fontSize * 1.3;
  ctx.font = `${node.fontSize}px ${node.fontFamily || "sans-serif"}`;

  let maxWidth = 0;
  for (const line of lines) {
    maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
  }

  const w = Math.max(NODE_MIN_WIDTH, maxWidth + NODE_PADDING_X * 2);
  const h = lines.length * lineHeight + NODE_PADDING_Y * 2;

  const x = node.x;
  const y = node.y;

  ctx.save();
  ctx.globalAlpha = node.style.opacity;

  // 1. Draw clean white background first (so text is always readable)
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, NODE_BORDER_RADIUS);
  ctx.fill();

  // 2. Draw rough.js border + optional fill on top
  //    Don't cache because selection state affects stroke color
  const nodeStyle = node.style;
  const roughness = nodeStyle.roughness ?? 1;
  const fillColor = nodeStyle.fillColor === "transparent" ? undefined : nodeStyle.fillColor;
  const fillStyle = nodeStyle.fillStyle || "hachure";
  const strokeColor = isSelected ? "#4a90d9" : node.nodeColor;
  const strokeWidth = isSelected ? 2 : 1.5;

  const path = roundedRectPath(x, y, w, h, NODE_BORDER_RADIUS);
  const generator = rough.generator();
  const drawable = generator.path(path, {
    seed: node.roughSeed || 1,
    roughness,
    stroke: strokeColor,
    strokeWidth,
    fill: fillColor,
    fillStyle,
    fillWeight: 1,
  });

  ctx.save();
  rc.draw(drawable);
  ctx.restore();

  // 3. Selection highlight — subtle outer glow
  if (isSelected) {
    ctx.strokeStyle = "rgba(74, 144, 217, 0.25)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x - 1, y - 1, w + 2, h + 2, NODE_BORDER_RADIUS + 1);
    ctx.stroke();
  }

  // 4. Text — always on top
  ctx.font = `${node.fontSize}px ${node.fontFamily || "sans-serif"}`;
  ctx.fillStyle = node.fontColor || "#333";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + NODE_PADDING_X, y + NODE_PADDING_Y + i * lineHeight);
  }

  // 5. Collapse marker — small pill with "+"
  if (node.collapsed && hasChildren) {
    const mx = x + w + 3;
    const my = y + h / 2 - COLLAPSE_MARKER_SIZE / 2;
    ctx.strokeStyle = node.nodeColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx, my, COLLAPSE_MARKER_SIZE, COLLAPSE_MARKER_SIZE, 3);
    ctx.stroke();
    ctx.fillStyle = node.nodeColor;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", mx + COLLAPSE_MARKER_SIZE / 2, my + COLLAPSE_MARKER_SIZE / 2);
  }

  ctx.restore();
}

// ---- Draw a mind map edge (rough.js style) ----
export function drawMindMapEdge(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  edge: MindMapEdgeElement,
  elements: WhiteboardElement[]
) {
  const fromNode = elements.find(
    (el) => el.id === edge.fromNodeId && el.type === "mindmap-node" && !el.isDeleted
  ) as MindMapNodeElement | undefined;
  const toNode = elements.find(
    (el) => el.id === edge.toNodeId && el.type === "mindmap-node" && !el.isDeleted
  ) as MindMapNodeElement | undefined;

  if (!fromNode || !toNode) return;

  // Measure node sizes to find connection points
  ctx.font = `${fromNode.fontSize}px sans-serif`;
  const fromSize = measureNode(ctx, fromNode);
  ctx.font = `${toNode.fontSize}px sans-serif`;
  const toSize = measureNode(ctx, toNode);

  // Connection points: right-center of parent, left-center of child
  const x1 = fromNode.x + fromSize.width;
  const y1 = fromNode.y + fromSize.height / 2;
  const x2 = toNode.x;
  const y2 = toNode.y + toSize.height / 2;

  // Bezier control points
  const cpx = Math.abs(x2 - x1) * 0.4;

  ctx.save();
  ctx.globalAlpha = edge.style.opacity * 0.8;

  // Use rough.js for sketchy bezier curve (don't cache — colors may change)
  const roughness = edge.style.roughness ?? 1;
  const svgPath = `M ${x1} ${y1} C ${x1 + cpx} ${y1}, ${x2 - cpx} ${y2}, ${x2} ${y2}`;

  const generator = rough.generator();
  const drawable = generator.path(svgPath, {
    seed: edge.roughSeed || 1,
    roughness,
    stroke: fromNode.nodeColor,
    strokeWidth: 1.5,
    fill: "none",
  });

  ctx.save();
  rc.draw(drawable);
  ctx.restore();

  ctx.restore();
}
