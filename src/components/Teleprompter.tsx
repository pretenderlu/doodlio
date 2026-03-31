import { useState, useRef, useCallback, useEffect } from "react";

interface TeleprompterProps {
  onClose: () => void;
}

export function Teleprompter({ onClose }: TeleprompterProps) {
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem("wb-teleprompter-text") || "";
    } catch {
      return "";
    }
  });
  const [opacity, setOpacity] = useState(0.85);
  const [fontSize, setFontSize] = useState(18);
  const [minimized, setMinimized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [pos, setPos] = useState({ x: 60, y: 120 });
  const scrollTimerRef = useRef<number>(0);
  const scrollAccumRef = useRef(0);

  // Persist text
  useEffect(() => {
    try {
      localStorage.setItem("wb-teleprompter-text", text);
    } catch { /* ignore */ }
  }, [text]);

  // Auto-scroll with sub-pixel accumulator
  useEffect(() => {
    if (!isPlaying || minimized) {
      cancelAnimationFrame(scrollTimerRef.current);
      return;
    }
    const el = textAreaRef.current;
    if (!el) return;
    scrollAccumRef.current = 0;

    const pxPerFrame = scrollSpeed * 0.1;

    const scroll = () => {
      scrollAccumRef.current += pxPerFrame;
      if (scrollAccumRef.current >= 1) {
        const px = Math.floor(scrollAccumRef.current);
        scrollAccumRef.current -= px;
        el.scrollTop += px;
      }
      if (el.scrollTop >= el.scrollHeight - el.clientHeight) {
        setIsPlaying(false);
      } else {
        scrollTimerRef.current = requestAnimationFrame(scroll);
      }
    };
    scrollTimerRef.current = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(scrollTimerRef.current);
  }, [isPlaying, minimized, scrollSpeed]);

  // Drag handlers
  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos({
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [pos]);

  const togglePlay = useCallback(() => {
    if (!isPlaying) {
      const el = textAreaRef.current;
      if (el && el.scrollTop >= el.scrollHeight - el.clientHeight - 1) {
        el.scrollTop = 0;
      }
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    const el = textAreaRef.current;
    if (el) el.scrollTop = 0;
  }, []);

  /* ---- SVG Icons ---- */
  const iconClipboard = (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="1" width="8" height="3" rx="0.5" />
      <path d="M4 2.5H3a1 1 0 00-1 1V14a1 1 0 001 1h10a1 1 0 001-1V3.5a1 1 0 00-1-1h-1" />
      <line x1="5" y1="7" x2="11" y2="7" />
      <line x1="5" y1="10" x2="9" y2="10" />
    </svg>
  );

  const iconMinimize = (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <line x1="2" y1="6" x2="10" y2="6" />
    </svg>
  );

  const iconExpand = (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="8" height="8" rx="1" />
    </svg>
  );

  const iconClose = (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" />
      <line x1="9.5" y1="2.5" x2="2.5" y2="9.5" />
    </svg>
  );

  const iconPlay = (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor" stroke="none">
      <polygon points="3,1 12,7 3,13" />
    </svg>
  );

  const iconPause = (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor" stroke="none">
      <rect x="2" y="1.5" width="3.5" height="11" rx="0.7" />
      <rect x="8.5" y="1.5" width="3.5" height="11" rx="0.7" />
    </svg>
  );

  const iconStop = (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor" stroke="none">
      <rect x="2" y="2" width="10" height="10" rx="1" />
    </svg>
  );

  return (
    <div
      ref={containerRef}
      className="teleprompter"
      data-teleprompter
      style={{
        left: pos.x,
        top: pos.y,
        opacity,
      }}
    >
      {/* Title bar */}
      <div className="teleprompter-titlebar" onPointerDown={onDragStart}>
        <span className="teleprompter-title">{iconClipboard} 提词器</span>
        <div className="teleprompter-titlebar-actions">
          <button
            className="teleprompter-btn"
            onClick={() => setMinimized(!minimized)}
            title={minimized ? "展开" : "最小化"}
          >
            {minimized ? iconExpand : iconMinimize}
          </button>
          <button className="teleprompter-btn teleprompter-close-btn" onClick={onClose} title="关闭">
            {iconClose}
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="teleprompter-body">
          <textarea
            ref={textAreaRef}
            className="teleprompter-text-area"
            style={{ fontSize }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="在此输入提词内容..."
          />

          {/* Compact controls bar */}
          <div className="teleprompter-controls">
            <div className="teleprompter-playback-row">
              <button
                className={`teleprompter-play-btn ${isPlaying ? "playing" : ""}`}
                onClick={togglePlay}
                title={isPlaying ? "暂停" : "播放"}
              >
                {isPlaying ? iconPause : iconPlay}
              </button>
              <button
                className="teleprompter-stop-btn"
                onClick={handleStop}
                title="停止并回到开头"
              >
                {iconStop}
              </button>
              <div className="teleprompter-speed-inline">
                <span className="teleprompter-speed-label">速度</span>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={scrollSpeed}
                  onChange={(e) => setScrollSpeed(Number(e.target.value))}
                  className="teleprompter-slider teleprompter-slider-inline"
                />
                <span className="teleprompter-value">{scrollSpeed}x</span>
              </div>
            </div>

            <div className="teleprompter-settings-row">
              <label className="teleprompter-label">字号</label>
              <input
                type="range"
                min={12}
                max={48}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="teleprompter-slider"
              />
              <span className="teleprompter-value">{fontSize}</span>
              <span className="teleprompter-sep">|</span>
              <label className="teleprompter-label">透明</label>
              <input
                type="range"
                min={20}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                className="teleprompter-slider"
              />
              <span className="teleprompter-value">{Math.round(opacity * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
