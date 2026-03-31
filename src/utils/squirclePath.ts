/**
 * Squircle (superellipse) path generation utilities.
 *
 * A superellipse is defined by:  |x/a|^n + |y/b|^n = 1
 * When n ≈ 4–5 it produces the iOS-style "squircle" shape with
 * continuous-curvature corners that look smoother than border-radius.
 */

const SQUIRCLE_EXPONENT = 5; // iOS-style curvature
const NUM_POINTS = 200;      // enough for smooth curves

/**
 * Generate points along a superellipse centered at origin.
 * @param a  half-width
 * @param b  half-height
 * @param n  superellipse exponent (default 5)
 * @returns  Array of [x, y] relative to center
 */
function superellipsePoints(
  a: number,
  b: number,
  n: number = SQUIRCLE_EXPONENT,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= NUM_POINTS; i++) {
    const t = (i / NUM_POINTS) * 2 * Math.PI;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const x = a * Math.sign(cosT) * Math.abs(cosT) ** (2 / n);
    const y = b * Math.sign(sinT) * Math.abs(sinT) ** (2 / n);
    pts.push([x, y]);
  }
  return pts;
}

/**
 * Generate an SVG path string for a squircle.
 * The path is positioned with top-left at (0, 0).
 * @param w  width
 * @param h  height
 * @param n  superellipse exponent (default 5)
 */
export function generateSquircleSVGPath(
  w: number,
  h: number,
  n: number = SQUIRCLE_EXPONENT,
): string {
  const a = w / 2;
  const b = h / 2;
  const pts = superellipsePoints(a, b, n);
  const parts: string[] = [];

  for (let i = 0; i < pts.length; i++) {
    const [px, py] = pts[i];
    // Shift from center-based to top-left-based coordinates
    const x = px + a;
    const y = py + b;
    if (i === 0) {
      parts.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
    } else {
      parts.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
  }
  parts.push("Z");
  return parts.join(" ");
}

/**
 * Draw a squircle path on a Canvas 2D context.
 * Creates a closed path (does NOT stroke or fill — caller decides).
 * @param ctx  canvas 2D context
 * @param x    top-left x
 * @param y    top-left y
 * @param w    width
 * @param h    height
 * @param n    superellipse exponent (default 5)
 */
export function drawSquirclePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  n: number = SQUIRCLE_EXPONENT,
): void {
  const a = w / 2;
  const b = h / 2;
  const cx = x + a;
  const cy = y + b;
  const pts = superellipsePoints(a, b, n);

  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const px = cx + pts[i][0];
    const py = cy + pts[i][1];
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}
