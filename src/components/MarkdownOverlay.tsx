import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { marked } from "marked";

interface Position {
  x: number;
  y: number;
}

export interface MarkdownPanelItem {
  id: string;
  fileName: string;
  content: string;
}

interface MarkdownOverlayProps {
  panel: MarkdownPanelItem;
  onClose: (id: string) => void;
  stackIndex?: number;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const DEFAULT_FONT_SIZE = 14;
const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 28;
const FONT_SIZE_STEP = 2;

export function MarkdownOverlay({
  panel,
  onClose,
  stackIndex = 0,
}: MarkdownOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Position>({ x: -1, y: -1 });
  const [width, setWidth] = useState(420);
  const [height, setHeight] = useState(480);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  // ---- Notify recording system about visual changes ----
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dispatchVisualChange = useCallback(() => {
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    changeTimerRef.current = setTimeout(() => {
      rootRef.current?.dispatchEvent(
        new CustomEvent('md-visual-change', { bubbles: true, detail: { id: panel.id } })
      );
    }, 500);
  }, [panel.id]);

  // Listen for scroll on content div → signal change
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = () => dispatchVisualChange();
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [dispatchVisualChange]);

  // Render markdown to HTML
  const htmlContent = useMemo(() => {
    try {
      return marked.parse(panel.content, { async: false }) as string;
    } catch {
      return `<pre>${panel.content}</pre>`;
    }
  }, [panel.content]);

  // Default position: offset based on stackIndex
  const effectivePos =
    pos.x < 0
      ? {
          x: 60 + stackIndex * 30,
          y: 80 + stackIndex * 30,
        }
      : pos;

  // ---- Drag ----
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

  // ---- Resize ----
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: width,
        startH: height,
      };
    },
    [width, height]
  );

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - resizeRef.current.startX;
    const dy = e.clientY - resizeRef.current.startY;
    setWidth(Math.max(MIN_WIDTH, resizeRef.current.startW + dx));
    setHeight(Math.max(MIN_HEIGHT, resizeRef.current.startH + dy));
  }, []);

  const handleResizeEnd = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dispatchVisualChange(); // re-snapshot after resize
  }, [dispatchVisualChange]);

  // Font size
  const zoomIn = useCallback(() => {
    setFontSize((prev) => Math.min(FONT_SIZE_MAX, prev + FONT_SIZE_STEP));
    dispatchVisualChange();
  }, [dispatchVisualChange]);
  const zoomOut = useCallback(() => {
    setFontSize((prev) => Math.max(FONT_SIZE_MIN, prev - FONT_SIZE_STEP));
    dispatchVisualChange();
  }, [dispatchVisualChange]);

  // Inject markdown styles
  useEffect(() => {
    const id = "md-overlay-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .md-overlay-content h1 { font-size: 1.8em; font-weight: 700; margin: 0.6em 0 0.4em; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
      .md-overlay-content h2 { font-size: 1.45em; font-weight: 600; margin: 0.5em 0 0.3em; border-bottom: 1px solid #eee; padding-bottom: 0.2em; }
      .md-overlay-content h3 { font-size: 1.2em; font-weight: 600; margin: 0.5em 0 0.2em; }
      .md-overlay-content h4, .md-overlay-content h5, .md-overlay-content h6 { font-size: 1.05em; font-weight: 600; margin: 0.4em 0 0.2em; }
      .md-overlay-content p { margin: 0.5em 0; line-height: 1.7; }
      .md-overlay-content ul, .md-overlay-content ol { padding-left: 1.5em; margin: 0.4em 0; }
      .md-overlay-content li { margin: 0.15em 0; line-height: 1.6; }
      .md-overlay-content code { background: rgba(0,0,0,0.06); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; font-family: 'SF Mono', 'Fira Code', Consolas, monospace; }
      .md-overlay-content pre { background: #1e1e2e; color: #cdd6f4; padding: 12px 16px; border-radius: 8px; overflow-x: auto; margin: 0.6em 0; }
      .md-overlay-content pre code { background: none; padding: 0; color: inherit; font-size: 0.88em; }
      .md-overlay-content blockquote { border-left: 3px solid #6c63ff; margin: 0.5em 0; padding: 0.3em 1em; background: rgba(108,99,255,0.05); border-radius: 0 6px 6px 0; }
      .md-overlay-content table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
      .md-overlay-content th, .md-overlay-content td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
      .md-overlay-content th { background: #f5f5f5; font-weight: 600; }
      .md-overlay-content img { max-width: 100%; border-radius: 6px; }
      .md-overlay-content a { color: #6c63ff; text-decoration: none; }
      .md-overlay-content a:hover { text-decoration: underline; }
      .md-overlay-content hr { border: none; border-top: 1px solid #e5e5e5; margin: 1em 0; }
      .md-overlay-content strong { font-weight: 600; }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div
      ref={rootRef}
      data-md-overlay
      style={{
        position: "fixed",
        left: effectivePos.x,
        top: effectivePos.y,
        width,
        height,
        zIndex: 998,
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow:
          "0 4px 16px rgba(0,0,0,0.12), 0 12px 40px rgba(0,0,0,0.18)",
        border: "1px solid rgba(0,0,0,0.08)",
        background: "#fff",
      }}
    >
      {/* ---- Title bar (drag handle) ---- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 12px",
          background: "linear-gradient(135deg, #f8f9fa 0%, #f0f1f3 100%)",
          borderBottom: "1px solid #e5e5e5",
          cursor: isDragging ? "grabbing" : "grab",
          flexShrink: 0,
        }}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        {/* File icon */}
        <span style={{ fontSize: 14, opacity: 0.6 }}>📄</span>
        {/* File name */}
        <span
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            color: "#444",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {panel.fileName}
        </span>

        {/* Font size controls */}
        <button
          onClick={(e) => { e.stopPropagation(); zoomOut(); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={controlBtnStyle}
          title="缩小字体"
        >
          A-
        </button>
        <span
          style={{
            fontSize: 10,
            color: "#888",
            minWidth: 28,
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          {fontSize}px
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); zoomIn(); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={controlBtnStyle}
          title="放大字体"
        >
          A+
        </button>

        {/* Close */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(panel.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            ...controlBtnStyle,
            color: "#e03131",
            marginLeft: 4,
          }}
          title="关闭"
        >
          ✕
        </button>
      </div>

      {/* ---- Markdown body ---- */}
      <div
        ref={contentRef}
        className="md-overlay-content"
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 20px",
          fontSize,
          color: "#333",
          lineHeight: 1.7,
          fontFamily: "'Inter', 'Noto Sans SC', -apple-system, sans-serif",
          userSelect: "text",
          cursor: "auto",
        }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {/* ---- Resize handle ---- */}
      <div
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 18,
          height: 18,
          cursor: "nwse-resize",
          zIndex: 1,
          touchAction: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={10} height={10} viewBox="0 0 10 10" style={{ opacity: 0.3 }}>
          <path d="M9 1L1 9M9 4L4 9M9 7L7 9" stroke="#666" strokeWidth={1.2} strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

const controlBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid rgba(0,0,0,0.1)",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
  color: "#555",
  padding: "2px 6px",
  lineHeight: 1,
};
