export interface Viewport {
  panX: number;
  panY: number;
  zoom: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;

export const DEFAULT_VIEWPORT: Viewport = {
  panX: 0,
  panY: 0,
  zoom: 1,
};
