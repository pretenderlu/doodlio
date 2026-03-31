import { useState, useRef, useCallback, useEffect, useId } from "react";
import { generateSquircleSVGPath } from "../utils/squirclePath";
import type { WebcamShape } from "./RecordingSetupModal";

interface Position {
  x: number;
  y: number;
}

interface WebcamOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isOn: boolean;
  onClose: () => void;
  borderRadius: number; // 0 = square, 50 = circle
  aspectRatio: number; // width / height (1 = square, 16/9 = landscape)
  shapeType: WebcamShape;
  initialWidth?: number;
}

const MIN_WIDTH = 80;

export function WebcamOverlay({
  videoRef,
  isOn,
  onClose,
  borderRadius,
  aspectRatio,
  shapeType,
  initialWidth = 200,
}: WebcamOverlayProps) {
  const [pos, setPos] = useState<Position>({ x: -1, y: -1 });
  const [width, setWidth] = useState(initialWidth);

  // Sync width when initialWidth prop changes (e.g. from settings slider)
  useEffect(() => {
    setWidth(initialWidth);
  }, [initialWidth]);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const height = Math.round(width / aspectRatio);
  const isSquircle = shapeType === "squircle";
  const clipId = useId();

  const effectivePos =
    pos.x < 0
      ? {
          x: window.innerWidth - width - 20,
          y: window.innerHeight - height - 20,
        }
      : pos;

  // ---- Drag handlers (on video container) ----
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

  // ---- Resize handlers (pointer capture on handle) ----
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      resizeRef.current = { startX: e.clientX, startWidth: width };
    },
    [width]
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeRef.current) return;
      e.stopPropagation();
      const delta = e.clientX - resizeRef.current.startX;
      setWidth(Math.max(MIN_WIDTH, resizeRef.current.startWidth + delta));
    },
    []
  );

  const handleResizeEnd = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    },
    []
  );

  if (!isOn) return null;

  // Squircle SVG path for clip-path
  const squirclePath = isSquircle ? generateSquircleSVGPath(width, height) : "";

  return (
    <div
      data-webcam-overlay-inner
      style={{
        position: "fixed",
        left: effectivePos.x,
        top: effectivePos.y,
        width,
        height,
        zIndex: 10000,
        userSelect: "none",
        // Apply drop-shadow on outer container for squircle (since clip-path clips box-shadow)
        filter: isSquircle
          ? "drop-shadow(0 2px 8px rgba(0,0,0,0.15)) drop-shadow(0 8px 24px rgba(0,0,0,0.25)) drop-shadow(0 12px 40px rgba(0,0,0,0.12))"
          : undefined,
      }}
    >
      {/* Hidden SVG for squircle clip path */}
      {isSquircle && (
        <svg
          width={0}
          height={0}
          style={{ position: "absolute" }}
        >
          <defs>
            <clipPath id={clipId}>
              <path d={squirclePath} />
            </clipPath>
          </defs>
        </svg>
      )}

      {/* Clipped video container — drag on this */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: isSquircle
            ? undefined
            : `${Math.min(width, height) * borderRadius / 100}px`,
          clipPath: isSquircle ? `url(#${clipId})` : undefined,
          overflow: "hidden",
          boxShadow: isSquircle
            ? undefined
            : "0 2px 8px rgba(0,0,0,0.15), 0 8px 32px rgba(0,0,0,0.25), 0 16px 48px rgba(0,0,0,0.12)",
          border: isSquircle ? undefined : "2.5px solid rgba(255,255,255,0.45)",
          cursor: isDragging ? "grabbing" : "grab",
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
            transform: "scaleX(-1)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* SVG border overlay for squircle — OUTSIDE the clipped div so it's not clipped */}
      {isSquircle && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        >
          <path
            d={squirclePath}
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={2.5}
          />
        </svg>
      )}

      {/* Close button — outside clip area, always visible */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
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
        title="关闭摄像头"
      >
        ✕
      </button>

      {/* Resize handle — outside clip area */}
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
