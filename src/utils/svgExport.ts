import rough from "roughjs";
import type { WhiteboardElement, MindMapNodeElement, MindMapEdgeElement } from "../types/elements";
import type { StyleOptions } from "../types/elements";
import { getFreehandOutline, getSvgPathFromStroke } from "./freehand";
import { estimateNodeSize } from "./mindmapHelpers";

function toRoughOptions(style: StyleOptions, seed: number) {
  return {
    seed,
    roughness: style.roughness,
    stroke: style.strokeColor,
    strokeWidth: style.strokeWidth,
    fill: style.fillColor === "transparent" ? undefined : style.fillColor,
    fillStyle: style.fillStyle || "hachure",
    strokeLineDash:
      style.strokeDasharray && style.strokeDasharray.length > 0
        ? style.strokeDasharray
        : undefined,
  };
}

function getElementBounds(el: WhiteboardElement): { minX: number; minY: number; maxX: number; maxY: number } {
  if ("points" in el && el.points && (el.type as string) !== "rectangle" && (el.type as string) !== "ellipse") {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of el.points) {
      minX = Math.min(minX, px); minY = Math.min(minY, py);
      maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
    }
    return { minX, minY, maxX, maxY };
  }
  if (el.type === "mindmap-node") {
    const size = estimateNodeSize(el as MindMapNodeElement);
    return { minX: el.x, minY: el.y, maxX: el.x + size.width, maxY: el.y + size.height };
  }
  const x1 = Math.min(el.x, el.x + el.width);
  const y1 = Math.min(el.y, el.y + el.height);
  return { minX: x1, minY: y1, maxX: x1 + Math.abs(el.width), maxY: y1 + Math.abs(el.height) };
}

export function exportSvg(elements: WhiteboardElement[]): string {
  const visible = elements.filter((el) => !el.isDeleted && !el.isHidden);
  if (visible.length === 0) return "<svg xmlns='http://www.w3.org/2000/svg'></svg>";

  // Compute overall bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of visible) {
    const b = getElementBounds(el);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  const pad = 20;
  const width = maxX - minX + pad * 2;
  const height = maxY - minY + pad * 2;
  const offsetX = -minX + pad;
  const offsetY = -minY + pad;

  // Create SVG element for rough.js
  const svgNs = "http://www.w3.org/2000/svg";
  const svgEl = document.createElementNS(svgNs, "svg");
  svgEl.setAttribute("xmlns", svgNs);
  svgEl.setAttribute("width", String(Math.ceil(width)));
  svgEl.setAttribute("height", String(Math.ceil(height)));
  svgEl.setAttribute("viewBox", `0 0 ${Math.ceil(width)} ${Math.ceil(height)}`);

  const rc = rough.svg(svgEl);
  const sorted = [...visible].sort((a, b) => a.zIndex - b.zIndex);

  for (const el of sorted) {
    const g = document.createElementNS(svgNs, "g");
    g.setAttribute("transform", `translate(${offsetX},${offsetY})`);
    if (el.style.opacity < 1) g.setAttribute("opacity", String(el.style.opacity));

    if (el.rotation) {
      const b = getElementBounds(el);
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const deg = (el.rotation * 180) / Math.PI;
      g.setAttribute("transform", `translate(${offsetX},${offsetY}) rotate(${deg},${cx},${cy})`);
    }

    switch (el.type) {
      case "pen": {
        if (el.highlighter) {
          const path = document.createElementNS(svgNs, "path");
          let d = `M ${el.points[0][0]} ${el.points[0][1]}`;
          for (let i = 1; i < el.points.length; i++) {
            d += ` L ${el.points[i][0]} ${el.points[i][1]}`;
          }
          path.setAttribute("d", d);
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", el.style.strokeColor);
          path.setAttribute("stroke-width", String(el.style.strokeWidth));
          path.setAttribute("stroke-linecap", "round");
          path.setAttribute("stroke-linejoin", "round");
          path.setAttribute("opacity", String(el.style.opacity));
          path.setAttribute("style", "mix-blend-mode:multiply");
          g.appendChild(path);
        } else if (el.lineStyle === "sketchy") {
          const opts = toRoughOptions(el.style, el.roughSeed);
          const pts: [number, number][] = el.points.map((p) => [p[0], p[1]]);
          const node = rc.linearPath(pts, opts);
          g.appendChild(node);
        } else {
          // Default freehand
          const outline = getFreehandOutline(el.points, el.style.strokeWidth);
          const pathData = getSvgPathFromStroke(outline);
          if (pathData) {
            const path = document.createElementNS(svgNs, "path");
            path.setAttribute("d", pathData);
            path.setAttribute("fill", el.style.strokeColor);
            g.appendChild(path);
          }
        }
        break;
      }
      case "rectangle": {
        const opts = toRoughOptions(el.style, el.roughSeed);
        const node = rc.rectangle(el.x, el.y, el.width, el.height, opts);
        g.appendChild(node);
        break;
      }
      case "ellipse": {
        const opts = toRoughOptions(el.style, el.roughSeed);
        const node = rc.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width, el.height, opts);
        g.appendChild(node);
        break;
      }
      case "line": {
        const [[x1, y1], [x2, y2]] = el.points;
        const opts = toRoughOptions(el.style, el.roughSeed);
        const node = rc.line(x1, y1, x2, y2, opts);
        g.appendChild(node);
        break;
      }
      case "arrow": {
        const [[x1, y1], [x2, y2]] = el.points;
        const opts = toRoughOptions(el.style, el.roughSeed);
        g.appendChild(rc.line(x1, y1, x2, y2, opts));
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = Math.max(12, el.style.strokeWidth * 5);
        const headAngle = Math.PI / 6;
        const ax = x2 - headLen * Math.cos(angle - headAngle);
        const ay = y2 - headLen * Math.sin(angle - headAngle);
        const bx = x2 - headLen * Math.cos(angle + headAngle);
        const by = y2 - headLen * Math.sin(angle + headAngle);
        g.appendChild(rc.line(x2, y2, ax, ay, opts));
        g.appendChild(rc.line(x2, y2, bx, by, opts));
        break;
      }
      case "text": {
        const text = document.createElementNS(svgNs, "text");
        text.setAttribute("x", String(el.x));
        text.setAttribute("font-family", el.fontFamily);
        text.setAttribute("font-size", String(el.fontSize));
        text.setAttribute("fill", el.fontColor || el.style.strokeColor);
        text.setAttribute("dominant-baseline", "text-before-edge");
        const lines = el.textContent.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const tspan = document.createElementNS(svgNs, "tspan");
          tspan.setAttribute("x", String(el.x));
          tspan.setAttribute("y", String(el.y + i * el.fontSize * 1.2));
          tspan.textContent = lines[i];
          text.appendChild(tspan);
        }
        if (el.showBorder) {
          const pad = el.fontSize * 0.4;
          const opts = toRoughOptions(el.style, el.roughSeed);
          const border = rc.rectangle(el.x - pad, el.y - pad, el.width + pad * 2, el.height + pad * 2, opts);
          g.appendChild(border);
        }
        g.appendChild(text);
        break;
      }
      case "image": {
        const img = document.createElementNS(svgNs, "image");
        img.setAttribute("x", String(el.x));
        img.setAttribute("y", String(el.y));
        img.setAttribute("width", String(el.width));
        img.setAttribute("height", String(el.height));
        img.setAttributeNS("http://www.w3.org/1999/xlink", "href", el.imageDataUrl);
        g.appendChild(img);
        break;
      }
      case "mindmap-node": {
        const node = el as MindMapNodeElement;
        const size = estimateNodeSize(node);
        const opts = {
          seed: node.roughSeed || 1,
          roughness: node.style.roughness ?? 1,
          stroke: node.nodeColor,
          strokeWidth: 1.5,
          fill: "#ffffff",
          fillStyle: "solid" as const,
        };
        const rectNode = rc.rectangle(node.x, node.y, size.width, size.height, opts);
        g.appendChild(rectNode);
        const text = document.createElementNS(svgNs, "text");
        text.setAttribute("x", String(node.x + 14));
        text.setAttribute("y", String(node.y + 8));
        text.setAttribute("font-family", node.fontFamily || "sans-serif");
        text.setAttribute("font-size", String(node.fontSize));
        text.setAttribute("fill", node.fontColor || "#333");
        text.setAttribute("dominant-baseline", "text-before-edge");
        const lines = (node.textContent || "").split("\n");
        for (let i = 0; i < lines.length; i++) {
          const tspan = document.createElementNS(svgNs, "tspan");
          tspan.setAttribute("x", String(node.x + 14));
          tspan.setAttribute("y", String(node.y + 8 + i * node.fontSize * 1.3));
          tspan.textContent = lines[i];
          text.appendChild(tspan);
        }
        g.appendChild(text);
        break;
      }
      case "mindmap-edge": {
        const edge = el as MindMapEdgeElement;
        const fromNode = visible.find((e) => e.id === edge.fromNodeId && e.type === "mindmap-node") as MindMapNodeElement | undefined;
        const toNode = visible.find((e) => e.id === edge.toNodeId && e.type === "mindmap-node") as MindMapNodeElement | undefined;
        if (fromNode && toNode) {
          const fromSize = estimateNodeSize(fromNode);
          const toSize = estimateNodeSize(toNode);
          const x1 = fromNode.x + fromSize.width;
          const y1 = fromNode.y + fromSize.height / 2;
          const x2 = toNode.x;
          const y2 = toNode.y + toSize.height / 2;
          const cpx = Math.abs(x2 - x1) * 0.4;
          const svgPath = `M ${x1} ${y1} C ${x1 + cpx} ${y1}, ${x2 - cpx} ${y2}, ${x2} ${y2}`;
          const pathEl = rc.path(svgPath, {
            seed: edge.roughSeed || 1,
            roughness: edge.style.roughness ?? 1,
            stroke: fromNode.nodeColor,
            strokeWidth: 1.5,
            fill: "none",
          });
          g.appendChild(pathEl);
        }
        break;
      }
    }

    if (g.childNodes.length > 0) svgEl.appendChild(g);
  }

  return new XMLSerializer().serializeToString(svgEl);
}
