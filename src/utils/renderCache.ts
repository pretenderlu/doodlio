/**
 * OffscreenCanvas render cache to avoid re-rendering
 * all elements on every frame when nothing changed.
 */

let cacheCanvas: OffscreenCanvas | null = null;
let lastElementsHash = "";
let lastViewportHash = "";

export function getCacheCanvas(width: number, height: number): OffscreenCanvas | null {
  try {
    if (!cacheCanvas || cacheCanvas.width !== width || cacheCanvas.height !== height) {
      cacheCanvas = new OffscreenCanvas(width, height);
      lastElementsHash = "";
      lastViewportHash = "";
    }
    return cacheCanvas;
  } catch {
    return null;
  }
}

export function isCacheValid(eHash: string, vHash: string): boolean {
  return !!cacheCanvas && lastElementsHash === eHash && lastViewportHash === vHash && eHash !== "";
}

export function updateCacheHashes(eHash: string, vHash: string) {
  lastElementsHash = eHash;
  lastViewportHash = vHash;
}

export function invalidateCache() {
  lastElementsHash = "";
  lastViewportHash = "";
}

function hashStr(s: string, hash: number): number {
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return hash;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hashElements(elements: readonly any[]): string {
  let hash = elements.length;
  for (const el of elements) {
    if (el.isDeleted) continue;
    // Geometry
    hash = (hash * 31 + (el.zIndex || 0)) | 0;
    hash = (hash * 31 + ((el.x || 0) * 100) | 0) | 0;
    hash = (hash * 31 + ((el.y || 0) * 100) | 0) | 0;
    if (el.width) hash = (hash * 31 + (el.width * 100) | 0) | 0;
    if (el.height) hash = (hash * 31 + (el.height * 100) | 0) | 0;
    if (el.rotation) hash = (hash * 31 + (el.rotation * 1000) | 0) | 0;
    if (el.isHidden) hash = (hash * 31 + 7) | 0;
    if (el.locked) hash = (hash * 31 + 13) | 0;
    // Style
    if (el.style) {
      hash = hashStr(el.style.strokeColor || "", hash);
      hash = hashStr(el.style.fillColor || "", hash);
      hash = (hash * 31 + ((el.style.strokeWidth || 0) * 10) | 0) | 0;
      hash = (hash * 31 + ((el.style.opacity ?? 1) * 100) | 0) | 0;
      hash = (hash * 31 + ((el.style.roughness || 0) * 10) | 0) | 0;
      if (el.style.fillStyle) hash = hashStr(el.style.fillStyle, hash);
      if (el.style.strokeDasharray?.length) hash = (hash * 31 + el.style.strokeDasharray.length) | 0;
      if (el.style.cornerRadius) hash = (hash * 31 + el.style.cornerRadius) | 0;
    }
    // Points (pen, line, arrow, eraser)
    if (el.points) {
      hash = (hash * 31 + el.points.length) | 0;
      if (el.points.length > 0) {
        const first = el.points[0];
        hash = (hash * 31 + ((first[0] || 0) * 100) | 0) | 0;
        hash = (hash * 31 + ((first[1] || 0) * 100) | 0) | 0;
      }
      if (el.points.length > 1) {
        const last = el.points[el.points.length - 1];
        hash = (hash * 31 + ((last[0] || 0) * 100) | 0) | 0;
        hash = (hash * 31 + ((last[1] || 0) * 100) | 0) | 0;
      }
    }
    // Text content
    if (el.textContent) hash = hashStr(el.textContent, hash);
    if (el.fontSize) hash = (hash * 31 + el.fontSize) | 0;
    if (el.fontFamily) hash = hashStr(el.fontFamily, hash);
    if (el.fontColor) hash = hashStr(el.fontColor, hash);
    if (el.showBorder) hash = (hash * 31 + 17) | 0;
    // Rough seed
    if (el.roughSeed) hash = (hash * 31 + el.roughSeed) | 0;
    // Pen-specific
    if (el.highlighter) hash = (hash * 31 + 19) | 0;
    if (el.lineStyle) hash = hashStr(el.lineStyle, hash);
    // Mind map node
    if (el.nodeColor) hash = hashStr(el.nodeColor, hash);
    if (el.collapsed) hash = (hash * 31 + 23) | 0;
    // Eraser size
    if (el.eraserSize) hash = (hash * 31 + el.eraserSize) | 0;
  }
  return String(hash);
}

export function hashViewport(v: { panX: number; panY: number; zoom: number }): string {
  return `${v.panX.toFixed(1)},${v.panY.toFixed(1)},${v.zoom.toFixed(4)}`;
}
