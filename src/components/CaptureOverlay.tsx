import { useState, useRef, useCallback, useEffect } from "react";

interface Position {
  x: number;
  y: number;
}

/** Normalized crop rect [0-1] */
interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

interface CaptureOverlayProps {
  sourceId: string;
  label: string;
  stream: MediaStream;
  onClose: (id: string) => void;
  registerVideoRef: (id: string, el: HTMLVideoElement | null) => void;
  initialWidth?: number;
  borderRadius?: number;
  /** Stacking offset index (0, 1, 2...) for default position */
  stackIndex?: number;
}

const MIN_WIDTH = 160;

// ---- Crop selector sub-component ----
interface CropSelectorProps {
  crop: CropRect;
  onChange: (c: CropRect) => void;
  onConfirm: () => void;
  onCancel: () => void;
  containerW: number;
  containerH: number;
}

type CropDragMode = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "w" | "e" | null;

function CropSelector({ crop, onChange, onConfirm, onCancel, containerW, containerH }: CropSelectorProps) {
  const dragRef = useRef<{ mode: CropDragMode; startX: number; startY: number; startCrop: CropRect } | null>(null);

  const px = (v: number, total: number) => v * total;

  const handlePointerDown = useCallback((e: React.PointerEvent, mode: CropDragMode) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, startCrop: { ...crop } };
  }, [crop]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    const { mode, startX, startY, startCrop } = dragRef.current;
    const dx = (e.clientX - startX) / containerW;
    const dy = (e.clientY - startY) / containerH;

    let next: CropRect;
    if (mode === "move") {
      const nx = Math.max(0, Math.min(1 - startCrop.w, startCrop.x + dx));
      const ny = Math.max(0, Math.min(1 - startCrop.h, startCrop.y + dy));
      next = { ...startCrop, x: nx, y: ny };
    } else {
      // Handle resize (corners and edges)
      let { x, y, w, h } = startCrop;
      const minSize = 0.1;
      // Left edge
      if (mode === "nw" || mode === "sw" || mode === "w") {
        const newX = Math.max(0, Math.min(x + w - minSize, x + dx));
        w = w - (newX - x);
        x = newX;
      }
      // Right edge
      if (mode === "ne" || mode === "se" || mode === "e") {
        w = Math.max(minSize, Math.min(1 - x, w + dx));
      }
      // Top edge
      if (mode === "nw" || mode === "ne" || mode === "n") {
        const newY = Math.max(0, Math.min(y + h - minSize, y + dy));
        h = h - (newY - y);
        y = newY;
      }
      // Bottom edge
      if (mode === "sw" || mode === "se" || mode === "s") {
        h = Math.max(minSize, Math.min(1 - y, h + dy));
      }
      next = { x, y, w, h };
    }
    onChange(next);
  }, [containerW, containerH, onChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const left = px(crop.x, containerW);
  const top = px(crop.y, containerH);
  const w = px(crop.w, containerW);
  const h = px(crop.h, containerH);

  // Corner handle: small visual dot with large invisible hit area
  const cornerHandle = (cx: number, cy: number, cursor: string, mode: CropDragMode) => (
    <div
      key={mode}
      style={{
        position: "absolute",
        // Large hit area: 32x32 centered on the corner
        left: cx - 16,
        top: cy - 16,
        width: 32,
        height: 32,
        cursor,
        zIndex: 5,
        touchAction: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onPointerDown={(e) => handlePointerDown(e, mode)}
    >
      {/* Visual dot */}
      <div style={{
        width: 14,
        height: 14,
        background: "#fff",
        border: "2.5px solid #1a73e8",
        borderRadius: 3,
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        pointerEvents: "none",
      }} />
    </div>
  );

  // Edge handle: invisible bar along the edge for easier grabbing
  const edgeHandle = (style: React.CSSProperties, mode: CropDragMode, cursor: string) => (
    <div
      key={mode}
      style={{
        position: "absolute",
        ...style,
        cursor,
        zIndex: 4,
        touchAction: "none",
      }}
      onPointerDown={(e) => handlePointerDown(e, mode)}
    />
  );

  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 3 }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Dimmed overlay outside crop area */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", pointerEvents: "none" }}>
        <div style={{
          position: "absolute", inset: 0,
          clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${left}px ${top}px, ${left}px ${top + h}px, ${left + w}px ${top + h}px, ${left + w}px ${top}px, ${left}px ${top}px)`,
          background: "rgba(0,0,0,0.45)",
        }} />
      </div>

      {/* Crop area (draggable) */}
      <div
        style={{
          position: "absolute",
          left, top, width: w, height: h,
          border: "2px solid #1a73e8",
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
          cursor: "move",
          zIndex: 3,
          touchAction: "none",
        }}
        onPointerDown={(e) => handlePointerDown(e, "move")}
      >
        {/* Grid lines */}
        <div style={{ position: "absolute", left: "33.3%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: "66.6%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "33.3%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "66.6%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
      </div>

      {/* Edge handles — invisible 12px-wide bars along each edge for easy grab */}
      {edgeHandle({ left: left + 16, top: top - 6, width: w - 32, height: 12 }, "n", "ns-resize")}
      {edgeHandle({ left: left + 16, top: top + h - 6, width: w - 32, height: 12 }, "s", "ns-resize")}
      {edgeHandle({ left: left - 6, top: top + 16, width: 12, height: h - 32 }, "w", "ew-resize")}
      {edgeHandle({ left: left + w - 6, top: top + 16, width: 12, height: h - 32 }, "e", "ew-resize")}

      {/* Corner handles — large hit area with small visual dot */}
      {cornerHandle(left, top, "nwse-resize", "nw")}
      {cornerHandle(left + w, top, "nesw-resize", "ne")}
      {cornerHandle(left, top + h, "nesw-resize", "sw")}
      {cornerHandle(left + w, top + h, "nwse-resize", "se")}

      {/* Confirm / Cancel buttons — inside crop area if no space below */}
      <div style={{
        position: "absolute",
        left: left + w / 2,
        ...( (top + h + 48) > containerH
          ? { bottom: containerH - (top + h) + 8, transform: "translateX(-50%)" }
          : { top: top + h + 12, transform: "translateX(-50%)" }
        ),
        display: "flex",
        gap: 6,
        zIndex: 5,
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); onConfirm(); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            height: 28, padding: "0 14px", border: "none", borderRadius: 6,
            background: "#1a73e8", color: "#fff", fontSize: 12, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M2 8l4 4 8-8" /></svg>
          确认
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            height: 28, padding: "0 14px", border: "none", borderRadius: 6,
            background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 12, fontWeight: 500,
            cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          取消
        </button>
      </div>
    </div>
  );
}

// ---- Main component ----
export function CaptureOverlay({
  sourceId,
  label,
  stream,
  onClose,
  registerVideoRef,
  initialWidth = 400,
  borderRadius = 12,
  stackIndex = 0,
}: CaptureOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pos, setPos] = useState<Position>({ x: -1, y: -1 });
  const [width, setWidth] = useState(initialWidth);

  // Sync width when initialWidth prop changes (e.g. from settings slider)
  useEffect(() => {
    setWidth(initialWidth);
  }, [initialWidth]);

  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Crop state
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [isCropping, setIsCropping] = useState(false);
  const [tempCrop, setTempCrop] = useState<CropRect>(FULL_CROP);
  const hasCrop = crop.x !== 0 || crop.y !== 0 || crop.w !== 1 || crop.h !== 1;

  // Base 16:9 for screen content; adapt to crop ratio when cropped
  const baseAspect = 16 / 9;
  const effectiveAspect = (!isCropping && hasCrop)
    ? baseAspect * (crop.w / crop.h)
    : baseAspect;
  const height = Math.round(width / effectiveAspect);

  // Default position: stacked from bottom-left corner
  const effectivePos =
    pos.x < 0
      ? {
          x: 20 + stackIndex * 30,
          y: window.innerHeight - height - 20 - stackIndex * 30,
        }
      : pos;

  // Attach stream to video element and register ref
  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.srcObject = stream;
      registerVideoRef(sourceId, el);
    }
    return () => {
      registerVideoRef(sourceId, null);
    };
  }, [stream, sourceId, registerVideoRef]);

  // ---- Drag handlers ----
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (isCropping) return;
      e.stopPropagation();
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - effectivePos.x,
        y: e.clientY - effectivePos.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [effectivePos, isCropping]
  );

  const handleDragMove = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      if (isDragging) {
        setPos({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        });
      }
    },
    [isDragging]
  );

  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  // ---- Resize handlers ----
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      if (isCropping) return;
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      resizeRef.current = { startX: e.clientX, startWidth: width };
    },
    [width, isCropping]
  );

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    e.stopPropagation();
    const delta = e.clientX - resizeRef.current.startX;
    setWidth(Math.max(MIN_WIDTH, resizeRef.current.startWidth + delta));
  }, []);

  const handleResizeEnd = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  // ---- Crop actions ----
  const enterCropMode = useCallback(() => {
    setTempCrop(crop);
    setIsCropping(true);
  }, [crop]);

  const confirmCrop = useCallback(() => {
    setCrop(tempCrop);
    setIsCropping(false);
  }, [tempCrop]);

  const cancelCrop = useCallback(() => {
    setIsCropping(false);
  }, []);

  const resetCrop = useCallback(() => {
    setCrop(FULL_CROP);
    setIsCropping(false);
  }, []);

  // Compute video style for crop display.
  // When cropped, the container aspect ratio differs from the base 16:9.
  // We must size the video to the BASE 16:9 dimensions so objectFit:cover
  // computes identically to the crop-mode preview, then use a uniform scale
  // to zoom into the crop region.
  //
  // Video base height as % of new container height = crop.w / crop.h
  // (because H_base / H_new = effectiveAspect / baseAspect = crop.w / crop.h)
  // Uniform scale = 1 / crop.w (same for both axes since aspect ratios match)
  const videoStyle: React.CSSProperties = (!isCropping && hasCrop)
    ? {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: `${(crop.w / crop.h) * 100}%`,
        objectFit: "cover" as const,
        pointerEvents: "none" as const,
        background: "#000",
        transformOrigin: "0 0",
        transform: `scale(${1 / crop.w}) translate(${-crop.x * 100}%, ${-crop.y * 100}%)`,
      }
    : {
        width: "100%",
        height: "100%",
        objectFit: "cover" as const,
        pointerEvents: "none" as const,
        background: "#000",
      };

  return (
    <div
      data-capture-overlay-inner
      data-capture-id={sourceId}
      data-crop-x={crop.x}
      data-crop-y={crop.y}
      data-crop-w={crop.w}
      data-crop-h={crop.h}
      style={{
        position: "fixed",
        left: effectivePos.x,
        top: effectivePos.y,
        width,
        height,
        zIndex: isCropping ? 10001 : 999,
        userSelect: "none",
      }}
    >
      {/* Video container with clipping */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: `${borderRadius}px`,
          overflow: "hidden",
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.15), 0 8px 32px rgba(0,0,0,0.25), 0 16px 48px rgba(0,0,0,0.12)",
          border: isCropping ? "2.5px solid #1a73e8" : "2.5px solid rgba(255,255,255,0.45)",
          cursor: isCropping ? "default" : isDragging ? "grabbing" : "grab",
          position: "relative",
        }}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={videoStyle}
        />

        {/* Source label badge */}
        {!isCropping && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              padding: "2px 8px",
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              letterSpacing: 0.3,
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
              maxWidth: "70%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4cd964", display: "inline-block", flexShrink: 0 }} />
            {label}
          </div>
        )}

        {/* Crop selector overlay */}
        {isCropping && (
          <CropSelector
            crop={tempCrop}
            onChange={setTempCrop}
            onConfirm={confirmCrop}
            onCancel={cancelCrop}
            containerW={width}
            containerH={height}
          />
        )}
      </div>

      {/* Close button */}
      {!isCropping && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose(sourceId);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: "2px solid #fff",
            backgroundColor: "rgba(0,0,0,0.65)",
            color: "#fff",
            fontSize: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            zIndex: 1,
          }}
          title="停止采集"
        >
          ✕
        </button>
      )}

      {/* Crop button */}
      {!isCropping && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            enterCropMode();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: -8,
            right: 22,
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: "2px solid #fff",
            backgroundColor: hasCrop ? "rgba(26,115,232,0.85)" : "rgba(0,0,0,0.65)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            zIndex: 1,
          }}
          title={hasCrop ? "编辑裁剪区域" : "裁剪画面"}
        >
          <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 0v12h12" />
            <path d="M0 4h12v12" />
          </svg>
        </button>
      )}

      {/* Reset crop button (when cropped) */}
      {!isCropping && hasCrop && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            resetCrop();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: -8,
            right: 52,
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: "2px solid #fff",
            backgroundColor: "rgba(0,0,0,0.65)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            zIndex: 1,
          }}
          title="重置裁剪"
        >
          <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 4h4L3.5 1.5" />
            <path d="M2 4a6 6 0 1 1 0 8" />
          </svg>
        </button>
      )}

      {/* Resize handle */}
      {!isCropping && (
        <div
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          style={{
            position: "absolute",
            bottom: -4,
            right: -4,
            width: 14,
            height: 14,
            cursor: "nwse-resize",
            borderRadius: 3,
            background: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(0,0,0,0.2)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            zIndex: 1,
            touchAction: "none",
          }}
        />
      )}
    </div>
  );
}
