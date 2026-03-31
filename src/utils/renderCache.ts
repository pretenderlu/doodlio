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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hashElements(elements: readonly any[]): string {
  let hash = elements.length;
  for (const el of elements) {
    if (el.isDeleted) continue;
    hash = (hash * 31 + (el.zIndex || 0)) | 0;
    hash = (hash * 31 + ((el.x || 0) * 100) | 0) | 0;
    hash = (hash * 31 + ((el.y || 0) * 100) | 0) | 0;
    if (el.width) hash = (hash * 31 + (el.width * 100) | 0) | 0;
    if (el.height) hash = (hash * 31 + (el.height * 100) | 0) | 0;
    if (el.rotation) hash = (hash * 31 + (el.rotation * 1000) | 0) | 0;
    if (el.isHidden) hash = (hash * 31 + 7) | 0;
    if (el.locked) hash = (hash * 31 + 13) | 0;
  }
  return String(hash);
}

export function hashViewport(v: { panX: number; panY: number; zoom: number }): string {
  return `${v.panX.toFixed(1)},${v.panY.toFixed(1)},${v.zoom.toFixed(4)}`;
}
