import { useState, useRef, useCallback, useEffect } from "react";

interface Position {
  x: number;
  y: number;
}

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

  // 16:9 aspect ratio for screen content
  const aspectRatio = 16 / 9;
  const height = Math.round(width / aspectRatio);

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
      e.stopPropagation();
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - effectivePos.x,
        y: e.clientY - effectivePos.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [effectivePos]
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
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      resizeRef.current = { startX: e.clientX, startWidth: width };
    },
    [width]
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

  return (
    <div
      data-capture-overlay-inner
      data-capture-id={sourceId}
      style={{
        position: "fixed",
        left: effectivePos.x,
        top: effectivePos.y,
        width,
        height,
        zIndex: 999,
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
          border: "2.5px solid rgba(255,255,255,0.45)",
          cursor: isDragging ? "grabbing" : "grab",
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
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            pointerEvents: "none",
            background: "#000",
          }}
        />

        {/* Source label badge */}
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
      </div>

      {/* Close button */}
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

      {/* Resize handle */}
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
    </div>
  );
}
