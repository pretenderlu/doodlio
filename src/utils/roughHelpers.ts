import rough from "roughjs";
import type { Drawable, Options as RoughOptions } from "roughjs/bin/core";
import type { StyleOptions } from "../types/elements";

const generator = rough.generator();

function toRoughOptions(style: StyleOptions, seed: number): RoughOptions {
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

export function createRoughRect(
  x: number,
  y: number,
  w: number,
  h: number,
  style: StyleOptions,
  seed: number
): Drawable {
  const opts = toRoughOptions(style, seed);
  const r = style.cornerRadius || 0;

  if (r > 0) {
    // Clamp radius to half of the smallest dimension
    const cr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    // Build an SVG rounded-rect path
    const right = x + w;
    const bottom = y + h;
    const path = [
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
    return generator.path(path, opts);
  }

  return generator.rectangle(x, y, w, h, opts);
}

export function createRoughEllipse(
  cx: number,
  cy: number,
  w: number,
  h: number,
  style: StyleOptions,
  seed: number
): Drawable {
  return generator.ellipse(cx, cy, w, h, toRoughOptions(style, seed));
}

export function createRoughLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: StyleOptions,
  seed: number
): Drawable {
  return generator.line(x1, y1, x2, y2, toRoughOptions(style, seed));
}

export function createRoughArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: StyleOptions,
  seed: number
): Drawable[] {
  const opts = toRoughOptions(style, seed);
  const mainLine = generator.line(x1, y1, x2, y2, opts);

  // Arrowhead: two short lines from endpoint at ±30°
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = Math.max(12, style.strokeWidth * 5);
  const headAngle = Math.PI / 6; // 30 degrees

  const ax = x2 - headLen * Math.cos(angle - headAngle);
  const ay = y2 - headLen * Math.sin(angle - headAngle);
  const bx = x2 - headLen * Math.cos(angle + headAngle);
  const by = y2 - headLen * Math.sin(angle + headAngle);

  const headA = generator.line(x2, y2, ax, ay, opts);
  const headB = generator.line(x2, y2, bx, by, opts);

  return [mainLine, headA, headB];
}

/**
 * Create a rough.js linearPath from an array of freehand points.
 * Points are downsampled to avoid overwhelming rough.js with too many segments.
 */
export function createRoughLinearPath(
  points: number[][],
  style: StyleOptions,
  seed: number
): Drawable {
  // Downsample: keep every Nth point based on total count
  const maxPoints = 80;
  let sampled: [number, number][];
  if (points.length <= maxPoints) {
    sampled = points.map((p) => [p[0], p[1]]);
  } else {
    const step = (points.length - 1) / (maxPoints - 1);
    sampled = [];
    for (let i = 0; i < maxPoints - 1; i++) {
      const idx = Math.round(i * step);
      sampled.push([points[idx][0], points[idx][1]]);
    }
    // Always include last point
    sampled.push([points[points.length - 1][0], points[points.length - 1][1]]);
  }

  const opts = toRoughOptions(style, seed);
  return generator.linearPath(sampled, opts);
}
