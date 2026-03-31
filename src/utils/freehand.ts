import getStroke from "perfect-freehand";

const FREEHAND_OPTIONS = {
  size: 8,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: true,
  last: true,
  start: { taper: 0, cap: true },
  end: { taper: 0, cap: true },
};

export function getFreehandOutline(
  points: number[][],
  strokeWidth: number
): number[][] {
  return getStroke(points, {
    ...FREEHAND_OPTIONS,
    size: strokeWidth * 3,
  });
}

/**
 * Convert outline points from perfect-freehand to an SVG path string.
 * Uses quadratic curves for smooth rendering.
 */
export function getSvgPathFromStroke(stroke: number[][]): string {
  if (stroke.length === 0) return "";

  const d: string[] = [];
  const [first, ...rest] = stroke;

  d.push(`M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`);

  if (rest.length === 0) {
    d.push("Z");
    return d.join(" ");
  }

  for (let i = 0; i < rest.length; i++) {
    const [x0, y0] = rest[i];
    const [x1, y1] = rest[(i + 1) % rest.length];
    const mx = ((x0 + x1) / 2).toFixed(2);
    const my = ((y0 + y1) / 2).toFixed(2);
    d.push(`Q ${x0.toFixed(2)} ${y0.toFixed(2)} ${mx} ${my}`);
  }

  d.push("Z");
  return d.join(" ");
}
