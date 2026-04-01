import { useState, useRef, useCallback, useEffect } from "react";
import { drawSquirclePath } from "../utils/squirclePath";
import html2canvas from "html2canvas";
import type { WebcamShape } from "../components/RecordingSetupModal";

// ---- Smart Zoom helpers ----

/** Smooth easing — gentle start AND end for comfortable transitions */
function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

interface VirtualCamera {
  // Current interpolated values
  zoom: number;       // 1 = full view, >1 = zoomed in
  centerX: number;    // 0..1 normalised position within canvas
  centerY: number;
  // Animation targets
  targetZoom: number;
  targetCenterX: number;
  targetCenterY: number;
  // Animation timing
  animStartTime: number;
  animDuration: number;  // ms
  // Snapshot of values at animation start (for lerp)
  fromZoom: number;
  fromCenterX: number;
  fromCenterY: number;
  // Idle detection
  lastActivityTime: number;
  isZoomedIn: boolean;
  // Smooth follow target (updated by mousemove, chased by lerp damping)
  followX: number;
  followY: number;
}

export type BackgroundConfig =
  | { type: "solid"; color: string }
  | { type: "gradient"; colors: string[]; angle: number };

interface RecordingStartOptions {
  staticCanvas: HTMLCanvasElement | null;
  dynamicCanvas: HTMLCanvasElement | null;
  webcamVideo: HTMLVideoElement | null;
  webcamBorderRadius: number;
  webcamShapeType?: WebcamShape;
  /** Called each frame to get current capture video elements (dynamic, not snapshot) */
  getCaptureVideos: () => HTMLVideoElement[];
  /** Called to get current capture streams for audio merging */
  getCaptureStreams?: () => MediaStream[];
  background: BackgroundConfig;
  canvasPadding?: number;
  canvasBorderRadius?: number;
  audioDeviceId?: string;
  cursorHighlight?: boolean;
  cursorHighlightColor?: string;
  cursorMagnify?: boolean;
  cursorMagnifySize?: number;   // scale factor, e.g. 1.5
  resolution?: string;       // e.g. "1920x1080"
  frameRate?: number;        // e.g. 30
  videoBitrate?: number;     // bps, e.g. 8_000_000
  // Smart Zoom
  smartZoom?: boolean;
  smartZoomLevel?: number;         // e.g. 1.5
  smartZoomTransition?: number;    // ms, e.g. 800
  smartZoomIdleDelay?: number;     // ms, e.g. 1500
  smartZoomDamping?: number;       // 0.01-0.15, lower = smoother follow
}

function applyBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bg: BackgroundConfig
) {
  if (bg.type === "solid") {
    ctx.fillStyle = bg.color;
  } else {
    // CSS angle convention: 0deg = bottom→top, 90deg = left→right
    const rad = (bg.angle * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const len = (Math.abs(dx) * w + Math.abs(dy) * h) / 2;
    const cx = w / 2,
      cy = h / 2;
    const grad = ctx.createLinearGradient(
      cx - dx * len,
      cy - dy * len,
      cx + dx * len,
      cy + dy * len
    );
    bg.colors.forEach((c, i) =>
      grad.addColorStop(i / (bg.colors.length - 1), c)
    );
    ctx.fillStyle = grad;
  }
  ctx.fillRect(0, 0, w, h);
}

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(
    0 as unknown as ReturnType<typeof setInterval>
  );
  const audioStreamRef = useRef<MediaStream | null>(null);
  const cursorPosRef = useRef<{ x: number; y: number } | null>(null);
  const cursorListenerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const mouseDownListenerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const cameraRef = useRef<VirtualCamera | null>(null);

  const startRecording = useCallback(
    async (options: RecordingStartOptions) => {
      const {
        staticCanvas, dynamicCanvas, webcamVideo, webcamBorderRadius,
        webcamShapeType = "circle", getCaptureVideos, getCaptureStreams,
        background, canvasPadding = 0, canvasBorderRadius = 0,
        audioDeviceId, cursorHighlight = false, cursorHighlightColor = "#e03131",
        cursorMagnify = false, cursorMagnifySize = 1.5,
        resolution = "1920x1080", frameRate = 30, videoBitrate = 8_000_000,
        smartZoom = false, smartZoomLevel = 1.5,
        smartZoomTransition = 800, smartZoomIdleDelay = 1500,
        smartZoomDamping = 0.03,
      } = options;
      if (!staticCanvas || !dynamicCanvas) return;

      const dpr = window.devicePixelRatio || 1;

      // Cursor tracking for highlight and smart zoom
      const needsCursorTracking = cursorHighlight || cursorMagnify || smartZoom;
      if (needsCursorTracking) {
        const frameEl = document.querySelector(".canvas-frame") as HTMLElement | null;
        if (frameEl) {
          const handler = (e: MouseEvent) => {
            const rect = frameEl.getBoundingClientRect();
            cursorPosRef.current = {
              x: (e.clientX - rect.left) * dpr,
              y: (e.clientY - rect.top) * dpr,
            };
            // Update smooth follow target (will be chased by lerp in compositeFrame)
            if (smartZoom && cameraRef.current && cameraRef.current.isZoomedIn) {
              const cam = cameraRef.current;
              cam.followX = (e.clientX - rect.left) / rect.width;
              cam.followY = (e.clientY - rect.top) / rect.height;
              cam.lastActivityTime = performance.now();
            }
          };
          frameEl.addEventListener("mousemove", handler);
          frameEl.addEventListener("mouseleave", () => { cursorPosRef.current = null; });
          cursorListenerRef.current = handler;
        }
      }

      // Smart Zoom: initialise virtual camera & mousedown listener
      if (smartZoom) {
        const now = performance.now();
        cameraRef.current = {
          zoom: 1, centerX: 0.5, centerY: 0.5,
          targetZoom: 1, targetCenterX: 0.5, targetCenterY: 0.5,
          animStartTime: now, animDuration: smartZoomTransition,
          fromZoom: 1, fromCenterX: 0.5, fromCenterY: 0.5,
          lastActivityTime: now, isZoomedIn: false,
          followX: 0.5, followY: 0.5,
        };
        const frameEl = document.querySelector(".canvas-frame") as HTMLElement | null;
        if (frameEl) {
          const downHandler = (e: MouseEvent) => {
            const cam = cameraRef.current;
            if (!cam) return;
            const rect = frameEl.getBoundingClientRect();
            const nx = (e.clientX - rect.left) / rect.width;
            const ny = (e.clientY - rect.top) / rect.height;
            const now = performance.now();
            // Snapshot current values as start of animation
            cam.fromZoom = cam.zoom;
            cam.fromCenterX = cam.centerX;
            cam.fromCenterY = cam.centerY;
            cam.targetZoom = smartZoomLevel;
            cam.targetCenterX = nx;
            cam.targetCenterY = ny;
            cam.followX = nx;
            cam.followY = ny;
            cam.animStartTime = now;
            cam.animDuration = smartZoomTransition;
            cam.lastActivityTime = now;
            cam.isZoomedIn = true;
          };
          frameEl.addEventListener("mousedown", downHandler);
          mouseDownListenerRef.current = downHandler;
        }
      }
      const offscreen = document.createElement("canvas");

      // Set offscreen resolution based on user selection
      const [targetW, targetH] = resolution.split("x").map(Number);
      // Determine the aspect ratio from the source canvas
      const srcAspect = staticCanvas.width / staticCanvas.height;
      // Calculate target dimensions maintaining source aspect ratio
      if (srcAspect >= targetW / targetH) {
        offscreen.width = targetW;
        offscreen.height = Math.round(targetW / srcAspect);
      } else {
        offscreen.height = targetH;
        offscreen.width = Math.round(targetH * srcAspect);
      }
      // Ensure even dimensions for video encoding
      offscreen.width = Math.round(offscreen.width / 2) * 2;
      offscreen.height = Math.round(offscreen.height / 2) * 2;

      const offCtx = offscreen.getContext("2d", { willReadFrequently: false })!;
      // High-quality rendering
      offCtx.imageSmoothingEnabled = true;
      offCtx.imageSmoothingQuality = "high";

      // Smart Zoom: create a temp canvas for two-pass compositing
      // Pass 1: compose everything at full size onto tempCanvas
      // Pass 2: crop/zoom from tempCanvas onto offscreen (which feeds the video stream)
      let compCanvas: HTMLCanvasElement;
      let compCtx: CanvasRenderingContext2D;
      if (smartZoom) {
        compCanvas = document.createElement("canvas");
        compCanvas.width = offscreen.width;
        compCanvas.height = offscreen.height;
        compCtx = compCanvas.getContext("2d", { willReadFrequently: false })!;
        compCtx.imageSmoothingEnabled = true;
        compCtx.imageSmoothingQuality = "high";
      } else {
        compCanvas = offscreen;
        compCtx = offCtx;
      }
      // ---- MD overlay snapshot cache (event-driven, NOT polling) ----
      const mdSnapshotCache = new Map<HTMLElement, HTMLCanvasElement>();
      let mdSnapshotBusy = false;

      const snapshotSingleOverlay = async (el: HTMLElement) => {
        if (mdSnapshotBusy) return;
        mdSnapshotBusy = true;
        try {
          const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            onclone: (doc: Document) => {
              doc.querySelectorAll('link[href*="fonts.googleapis"]').forEach(l => l.remove());
            },
          });
          mdSnapshotCache.set(el, canvas);
        } catch (err) {
          console.warn('MD snapshot failed:', err);
        } finally {
          mdSnapshotBusy = false;
        }
      };

      // Initial one-time snapshot of all existing overlays
      const initialOverlays = document.querySelectorAll<HTMLElement>("[data-md-overlay]");
      for (const el of initialOverlays) {
        snapshotSingleOverlay(el); // fire-and-forget, non-blocking
      }

      // Event-driven re-snapshot: listen for 'md-visual-change' from MarkdownOverlay
      const mdChangeTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
      const handleMdVisualChange = (e: Event) => {
        const overlay = (e.target as HTMLElement).closest('[data-md-overlay]') as HTMLElement | null;
        if (!overlay) return;
        // Debounce per-overlay (800ms after last change)
        const prev = mdChangeTimers.get(overlay);
        if (prev) clearTimeout(prev);
        mdChangeTimers.set(overlay, setTimeout(() => {
          mdChangeTimers.delete(overlay);
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => snapshotSingleOverlay(overlay));
          } else {
            snapshotSingleOverlay(overlay);
          }
        }, 800));
      };
      document.addEventListener('md-visual-change', handleMdVisualChange);

      // Slow periodic check for newly added/removed overlays (every 5s)
      const mdSyncInterval = setInterval(() => {
        const currentOverlays = document.querySelectorAll<HTMLElement>("[data-md-overlay]");
        const currentSet = new Set<HTMLElement>(currentOverlays);
        // Snapshot new overlays
        for (const el of currentOverlays) {
          if (!mdSnapshotCache.has(el)) {
            snapshotSingleOverlay(el);
          }
        }
        // Remove stale entries
        for (const key of mdSnapshotCache.keys()) {
          if (!currentSet.has(key)) mdSnapshotCache.delete(key);
        }
      }, 5000);

      // Compositing loop — throttled to target framerate to avoid competing with drawing
      const frameInterval = 1000 / frameRate;
      let lastFrameTime = 0;

      const compositeFrame = (timestamp: number) => {
        // Throttle: only composite at target framerate
        if (timestamp - lastFrameTime < frameInterval) {
          animFrameRef.current = requestAnimationFrame(compositeFrame);
          return;
        }
        lastFrameTime = timestamp;

        const W = offscreen.width;
        const H = offscreen.height;

        // Scale factor from source canvas pixels to offscreen pixels
        const resScale = W / staticCanvas.width;

        // ---- Smart Zoom: update virtual camera ----
        const cam = cameraRef.current;
        if (smartZoom && cam) {
          const now = performance.now();
          // Check idle → trigger zoom out
          if (cam.isZoomedIn && now - cam.lastActivityTime > smartZoomIdleDelay) {
            cam.fromZoom = cam.zoom;
            cam.fromCenterX = cam.centerX;
            cam.fromCenterY = cam.centerY;
            cam.targetZoom = 1;
            cam.targetCenterX = 0.5;
            cam.targetCenterY = 0.5;
            cam.animStartTime = now;
            cam.animDuration = smartZoomTransition * 1.3; // zoom-out slightly slower for comfort
            cam.isZoomedIn = false;
          }
          // Interpolate zoom transition with smooth easing (gentle start + end)
          const elapsed = now - cam.animStartTime;
          const rawT = cam.animDuration > 0 ? Math.min(elapsed / cam.animDuration, 1) : 1;
          const t = easeInOutQuart(rawT);
          cam.zoom = cam.fromZoom + (cam.targetZoom - cam.fromZoom) * t;

          if (rawT < 1) {
            // During zoom transition: interpolate center with same smooth easing
            cam.centerX = cam.fromCenterX + (cam.targetCenterX - cam.fromCenterX) * t;
            cam.centerY = cam.fromCenterY + (cam.targetCenterY - cam.fromCenterY) * t;
          }

          // When zoomed in: smoothly chase the follow target with lerp damping
          // Dead zone: ignore tiny mouse movements to reduce micro-jitter
          if (cam.isZoomedIn && rawT >= 1) {
            const dx = cam.followX - cam.centerX;
            const dy = cam.followY - cam.centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const deadZone = 0.01; // ~1% of canvas = ignore small movements
            if (dist > deadZone) {
              // Scale damping by distance — small movements get extra smoothing
              const scaledDamping = smartZoomDamping * Math.min(dist * 10, 1);
              cam.centerX += dx * scaledDamping;
              cam.centerY += dy * scaledDamping;
            }
          }
        }

        // 1) Background layer
        applyBackground(compCtx, W, H, background);

        // 2) Draw whiteboard canvases (inset by canvasPadding, with optional border radius)
        const padPx = canvasPadding * resScale * dpr;
        const insetX = padPx;
        const insetY = padPx;
        const insetW = W - padPx * 2;
        const insetH = H - padPx * 2;
        const radPx = canvasBorderRadius > 0 ? canvasBorderRadius * resScale * dpr : 0;

        compCtx.save();
        compCtx.beginPath();
        compCtx.roundRect(insetX, insetY, insetW, insetH, radPx);
        compCtx.clip();
        // Fill canvas area with white first (canvas content is transparent)
        compCtx.fillStyle = "#ffffff";
        compCtx.fillRect(insetX, insetY, insetW, insetH);


        // Use direct canvas upscaling for recording — avoids expensive renderScene per frame
        compCtx.drawImage(staticCanvas, insetX, insetY, insetW, insetH);
        compCtx.drawImage(dynamicCanvas, insetX, insetY, insetW, insetH);
        compCtx.restore();

        // 3) Cursor highlight (drawn to compCtx so it zooms with content)
        if (cursorHighlight && cursorPosRef.current) {
          const curX = cursorPosRef.current.x;
          const curY = cursorPosRef.current.y;
          const canvasScale = padPx > 0 ? insetW / W : 1;
          const cx = insetX + curX * resScale * canvasScale;
          const cy = insetY + curY * resScale * canvasScale;
          const hlRadius = 18 * resScale * dpr;
          compCtx.save();
          compCtx.globalAlpha = 0.35;
          compCtx.fillStyle = cursorHighlightColor;
          compCtx.beginPath();
          compCtx.arc(cx, cy, hlRadius, 0, Math.PI * 2);
          compCtx.fill();
          compCtx.globalAlpha = 0.7;
          compCtx.beginPath();
          compCtx.arc(cx, cy, 4 * resScale * dpr, 0, Math.PI * 2);
          compCtx.fill();
          compCtx.restore();
        }

        // 3a) Magnified cursor — draw an enlarged arrow pointer
        if (cursorMagnify && cursorPosRef.current) {
          const curX = cursorPosRef.current.x;
          const curY = cursorPosRef.current.y;
          const canvasScale = padPx > 0 ? insetW / W : 1;
          const cx = insetX + curX * resScale * canvasScale;
          const cy = insetY + curY * resScale * canvasScale;
          const s = cursorMagnifySize * resScale * dpr;
          compCtx.save();
          compCtx.translate(cx, cy);
          // Arrow pointer shape (standard cursor), scaled
          compCtx.beginPath();
          compCtx.moveTo(0, 0);
          compCtx.lineTo(0, 14 * s);
          compCtx.lineTo(3.8 * s, 10.8 * s);
          compCtx.lineTo(7.2 * s, 17.2 * s);
          compCtx.lineTo(9.6 * s, 16 * s);
          compCtx.lineTo(6.2 * s, 9.6 * s);
          compCtx.lineTo(11 * s, 9 * s);
          compCtx.closePath();
          // White fill with dark outline
          compCtx.fillStyle = "#fff";
          compCtx.fill();
          compCtx.strokeStyle = "#222";
          compCtx.lineWidth = 1.2 * s;
          compCtx.lineJoin = "round";
          compCtx.stroke();
          compCtx.restore();
        }

        // 3.5) Draw capture source overlays BEFORE zoom — they are part of whiteboard content
        //      When Smart Zoom zooms in, captures scale naturally with the canvas
        const currentCaptureVideos = getCaptureVideos();
        for (const captureVideo of currentCaptureVideos) {
          if (!captureVideo || captureVideo.readyState < 2) continue;
          const captureEl = captureVideo.closest(
            "[data-capture-overlay-inner]"
          ) as HTMLElement | null;
          const frameEl2 = document.querySelector(
            ".canvas-frame"
          ) as HTMLElement | null;

          if (captureEl && frameEl2) {
            const cRect = captureEl.getBoundingClientRect();
            const fRect2 = frameEl2.getBoundingClientRect();

            const pxScale2 = resScale * dpr;
            const canvasScale2 = padPx > 0 ? insetW / W : 1;

            // Full size — no capScale shrinking, since captures are content
            const cdw = cRect.width * pxScale2 * canvasScale2;
            const cdh = cRect.height * pxScale2 * canvasScale2;

            // Position relative to frame
            const baseLeft = cRect.left - fRect2.left;
            const baseBottom2 = fRect2.bottom - cRect.bottom;
            const marginLeft = baseLeft * pxScale2 * canvasScale2;
            const marginBottom2 = baseBottom2 * pxScale2 * canvasScale2;
            const cdx = marginLeft;
            const cdy = H - cdh - marginBottom2;

            const capRadius = 12 * resScale;

            // ---- Shadow ----
            const OFF2 = 10000;
            compCtx.save();
            compCtx.shadowColor = "rgba(0, 0, 0, 0.25)";
            compCtx.shadowBlur = 16 * resScale;
            compCtx.shadowOffsetX = -OFF2;
            compCtx.shadowOffsetY = 3 * resScale - OFF2;
            compCtx.fillStyle = "#000";
            compCtx.beginPath();
            compCtx.roundRect(cdx + OFF2, cdy + OFF2, cdw, cdh, capRadius);
            compCtx.fill();
            compCtx.restore();

            // ---- Draw capture video ----
            compCtx.save();
            compCtx.beginPath();
            compCtx.roundRect(cdx, cdy, cdw, cdh, capRadius);
            compCtx.clip();

            const cvw = captureVideo.videoWidth;
            const cvh = captureVideo.videoHeight;
            const capVideoAspect = cvw / cvh;
            const capTargetAspect = cdw / cdh;
            let csx: number, csy: number, csw: number, csh: number;
            if (capVideoAspect > capTargetAspect) {
              csh = cvh;
              csw = cvh * capTargetAspect;
              csx = (cvw - csw) / 2;
              csy = 0;
            } else {
              csw = cvw;
              csh = cvw / capTargetAspect;
              csx = 0;
              csy = (cvh - csh) / 2;
            }

            compCtx.drawImage(captureVideo, csx, csy, csw, csh, cdx, cdy, cdw, cdh);
            compCtx.restore();

            // ---- White glass border ----
            compCtx.save();
            compCtx.beginPath();
            compCtx.roundRect(cdx, cdy, cdw, cdh, capRadius);
            compCtx.strokeStyle = "rgba(255, 255, 255, 0.45)";
            compCtx.lineWidth = 2.5 * pxScale2;
            compCtx.stroke();
            compCtx.restore();
          }
        }

        // 3.6) Draw MD overlay snapshots BEFORE zoom — they are whiteboard content
        for (const [el, snapshot] of mdSnapshotCache.entries()) {
          if (!snapshot) continue;
          const frameEl3 = document.querySelector(".canvas-frame") as HTMLElement | null;
          if (!frameEl3) continue;
          const mdRect = el.getBoundingClientRect();
          const fRect3 = frameEl3.getBoundingClientRect();

          const pxScale3 = resScale * dpr;
          const canvasScale3 = padPx > 0 ? insetW / W : 1;

          const mdw = mdRect.width * pxScale3 * canvasScale3;
          const mdh = mdRect.height * pxScale3 * canvasScale3;
          const mdLeft = (mdRect.left - fRect3.left) * pxScale3 * canvasScale3;
          const mdBottom = (fRect3.bottom - mdRect.bottom) * pxScale3 * canvasScale3;
          const mdx = mdLeft;
          const mdy = H - mdh - mdBottom;
          const mdRadius = 12 * resScale;

          // Shadow
          const OFF3 = 10000;
          compCtx.save();
          compCtx.shadowColor = "rgba(0, 0, 0, 0.18)";
          compCtx.shadowBlur = 12 * resScale;
          compCtx.shadowOffsetX = -OFF3;
          compCtx.shadowOffsetY = 2 * resScale - OFF3;
          compCtx.fillStyle = "#000";
          compCtx.beginPath();
          compCtx.roundRect(mdx + OFF3, mdy + OFF3, mdw, mdh, mdRadius);
          compCtx.fill();
          compCtx.restore();

          // Draw snapshot
          compCtx.save();
          compCtx.beginPath();
          compCtx.roundRect(mdx, mdy, mdw, mdh, mdRadius);
          compCtx.clip();
          compCtx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, mdx, mdy, mdw, mdh);
          compCtx.restore();

          // Border
          compCtx.save();
          compCtx.beginPath();
          compCtx.roundRect(mdx, mdy, mdw, mdh, mdRadius);
          compCtx.strokeStyle = "rgba(0, 0, 0, 0.08)";
          compCtx.lineWidth = 1.5 * resScale;
          compCtx.stroke();
          compCtx.restore();
        }

        // 3.7) Draw laser pointer overlay BEFORE zoom — laser is content that should zoom with canvas
        const laserCanvasEl = document.querySelector('canvas[style*="z-index: 5000"]') as HTMLCanvasElement | null;
        if (laserCanvasEl && laserCanvasEl.width > 0) {
          const frameElLaser = document.querySelector(".canvas-frame") as HTMLElement | null;
          if (frameElLaser) {
            const lfRect = frameElLaser.getBoundingClientRect();
            const srcDpr = window.devicePixelRatio || 1;
            const sx = lfRect.left * srcDpr;
            const sy = lfRect.top * srcDpr;
            const sw = lfRect.width * srcDpr;
            const sh = lfRect.height * srcDpr;
            // Draw laser onto the compositing canvas (compCtx) so Smart Zoom applies to it
            const dlx = padPx > 0 ? (W - insetW) / 2 : 0;
            const dly = padPx > 0 ? (H - insetW / (lfRect.width / lfRect.height)) / 2 : 0;
            const dlw = padPx > 0 ? insetW : W;
            const dlh = padPx > 0 ? insetW / (lfRect.width / lfRect.height) : H;
            compCtx.save();
            compCtx.drawImage(laserCanvasEl, sx, sy, sw, sh, dlx, dly, dlw, dlh);
            compCtx.restore();
          }
        }

        // 4) Smart Zoom: copy composed frame to output canvas
        const camZoom = (smartZoom && cam) ? cam.zoom : 1;
        if (smartZoom && compCanvas !== offscreen) {
          if (camZoom > 1.001) {
            // Zoom in: crop a sub-region of the composed frame
            const cropW = W / cam!.zoom;
            const cropH = H / cam!.zoom;
            let cropX = cam!.centerX * W - cropW / 2;
            let cropY = cam!.centerY * H - cropH / 2;
            cropX = Math.max(0, Math.min(cropX, W - cropW));
            cropY = Math.max(0, Math.min(cropY, H - cropH));
            offCtx.clearRect(0, 0, W, H);
            offCtx.drawImage(compCanvas, cropX, cropY, cropW, cropH, 0, 0, W, H);
          } else {
            // No zoom: copy full composed frame to output
            offCtx.clearRect(0, 0, W, H);
            offCtx.drawImage(compCanvas, 0, 0);
          }
        }

        // 5) Draw webcam overlay AFTER zoom — webcam always stays visible and unaffected by zoom
        //    When zoomed in, webcam shrinks proportionally to give more space for content
        if (webcamVideo && webcamVideo.readyState >= 2) {
          const overlayEl = document.querySelector(
            "[data-webcam-overlay-inner]"
          ) as HTMLElement | null;
          const frameEl = document.querySelector(
            ".canvas-frame"
          ) as HTMLElement | null;

          if (overlayEl && frameEl) {
            const oRect = overlayEl.getBoundingClientRect();
            const fRect = frameEl.getBoundingClientRect();

            // Scale webcam position/size: screen px → offscreen px
            const pxScale = resScale * dpr;
            const canvasScale = padPx > 0 ? insetW / W : 1;

            // Base dimensions from screen DOM
            const baseDw = oRect.width * pxScale * canvasScale;
            const baseDh = oRect.height * pxScale * canvasScale;

            // When smart-zoomed in, shrink webcam using sqrt for a natural feel
            // 1x zoom → 100% size, 1.8x → ~75%, 3x → ~58%
            const wcScale = camZoom > 1.001 ? 1 / Math.sqrt(camZoom) : 1;
            const dw = baseDw * wcScale;
            const dh = baseDh * wcScale;

            // Keep webcam anchored to its corner — compute offset from bottom-right of frame
            const baseRight = fRect.right - oRect.right;  // distance from right edge (screen px)
            const baseBottom = fRect.bottom - oRect.bottom; // distance from bottom edge (screen px)
            const marginRight = baseRight * pxScale * canvasScale;
            const marginBottom = baseBottom * pxScale * canvasScale;
            const dx = W - dw - marginRight;
            const dy = H - dh - marginBottom;

            const radiusFraction = webcamBorderRadius / 100;
            const radius = Math.min(dw, dh) * radiusFraction;
            const isSquircle = webcamShapeType === "squircle";

            const drawWebcamShape = (ctx: CanvasRenderingContext2D, ox: number, oy: number) => {
              if (isSquircle) {
                drawSquirclePath(ctx, ox, oy, dw, dh);
              } else {
                ctx.beginPath();
                ctx.roundRect(ox, oy, dw, dh, radius);
              }
            };

            // ---- Shadow-only rendering (scaled with webcam size) ----
            const OFF = 10000;
            const shadowScale = resScale * wcScale;

            offCtx.save();
            offCtx.shadowColor = "rgba(0, 0, 0, 0.25)";
            offCtx.shadowBlur = 16 * shadowScale;
            offCtx.shadowOffsetX = -OFF;
            offCtx.shadowOffsetY = 3 * shadowScale - OFF;
            offCtx.fillStyle = "#000";
            drawWebcamShape(offCtx, dx + OFF, dy + OFF);
            offCtx.fill();
            offCtx.restore();

            offCtx.save();
            offCtx.shadowColor = "rgba(0, 0, 0, 0.15)";
            offCtx.shadowBlur = 32 * shadowScale;
            offCtx.shadowOffsetX = -OFF;
            offCtx.shadowOffsetY = 8 * shadowScale - OFF;
            offCtx.fillStyle = "#000";
            drawWebcamShape(offCtx, dx + OFF, dy + OFF);
            offCtx.fill();
            offCtx.restore();

            // ---- Draw webcam video ----
            offCtx.save();
            drawWebcamShape(offCtx, dx, dy);
            offCtx.clip();

            const vw = webcamVideo.videoWidth;
            const vh = webcamVideo.videoHeight;
            const videoAspect = vw / vh;
            const targetAspect = dw / dh;
            let sx: number, sy: number, sw: number, sh: number;
            if (videoAspect > targetAspect) {
              sh = vh;
              sw = vh * targetAspect;
              sx = (vw - sw) / 2;
              sy = 0;
            } else {
              sw = vw;
              sh = vw / targetAspect;
              sx = 0;
              sy = (vh - sh) / 2;
            }

            offCtx.translate(dx + dw, dy);
            offCtx.scale(-1, 1);
            offCtx.drawImage(webcamVideo, sx, sy, sw, sh, 0, 0, dw, dh);
            offCtx.restore();

            // ---- White glass border ----
            offCtx.save();
            drawWebcamShape(offCtx, dx, dy);
            offCtx.strokeStyle = "rgba(255, 255, 255, 0.45)";
            offCtx.lineWidth = 2.5 * pxScale;
            offCtx.stroke();
            offCtx.restore();

            // ---- Glass reflection highlight ----
            offCtx.save();
            drawWebcamShape(offCtx, dx, dy);
            offCtx.clip();
            const glassGrad = offCtx.createLinearGradient(dx, dy, dx, dy + dh * 0.35);
            glassGrad.addColorStop(0, "rgba(255, 255, 255, 0.12)");
            glassGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
            offCtx.fillStyle = glassGrad;
            offCtx.fillRect(dx, dy, dw, dh * 0.35);
            offCtx.restore();
          }
        }

        animFrameRef.current = requestAnimationFrame(compositeFrame);
      };

      animFrameRef.current = requestAnimationFrame(compositeFrame);

      // Capture video stream with user-specified framerate
      const videoStream = offscreen.captureStream(frameRate);

      // Try microphone
      let audioStream: MediaStream | null = null;
      try {
        const audioConstraints: MediaStreamConstraints = {
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        };
        audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
        audioStreamRef.current = audioStream;
      } catch {
        console.warn("无法获取麦克风权限，将录制无声视频");
      }

      // Combine streams
      const tracks = [...videoStream.getVideoTracks()];
      if (audioStream) {
        tracks.push(...audioStream.getAudioTracks());
      }
      // Merge capture source audio tracks (system audio from tab capture)
      const currentCaptureStreams = getCaptureStreams ? getCaptureStreams() : [];
      for (const capStream of currentCaptureStreams) {
        if (capStream) {
          const capAudioTracks = capStream.getAudioTracks();
          tracks.push(...capAudioTracks);
        }
      }
      const combinedStream = new MediaStream(tracks);

      // Prefer MP4, fall back to WebM
      const mimeTypes = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4;codecs=avc1,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mimeType =
        mimeTypes.find((mt) => MediaRecorder.isTypeSupported(mt)) ||
        "video/webm";
      const isMp4 = mimeType.startsWith("video/mp4");

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: videoBitrate,
      });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const ext = isMp4 ? "mp4" : "webm";
        const blobType = isMp4 ? "video/mp4" : "video/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        a.download = `whiteboard_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);

        cancelAnimationFrame(animFrameRef.current);
        clearInterval(mdSyncInterval);
        document.removeEventListener('md-visual-change', handleMdVisualChange);
        for (const t of mdChangeTimers.values()) clearTimeout(t);
        mdChangeTimers.clear();
        mdSnapshotCache.clear();
        audioStreamRef.current?.getTracks().forEach((t) => t.stop());
        // Clean up cursor listener
        if (cursorListenerRef.current) {
          const frameEl = document.querySelector(".canvas-frame");
          frameEl?.removeEventListener("mousemove", cursorListenerRef.current as EventListener);
          cursorListenerRef.current = null;
          cursorPosRef.current = null;
        }
        // Clean up smart zoom mousedown listener
        if (mouseDownListenerRef.current) {
          const frameEl = document.querySelector(".canvas-frame");
          frameEl?.removeEventListener("mousedown", mouseDownListenerRef.current as EventListener);
          mouseDownListenerRef.current = null;
          cameraRef.current = null;
        }
        audioStreamRef.current = null;
        chunksRef.current = [];
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      setIsRecording(true);
      setDuration(0);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    },
    []
  );

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
    setDuration(0);
  }, []);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      cancelAnimationFrame(animFrameRef.current);
      clearInterval(timerRef.current);
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { isRecording, duration, startRecording, stopRecording };
}
