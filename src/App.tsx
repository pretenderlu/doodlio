import { useState, useCallback, useEffect, useRef } from "react";
import { WhiteboardProvider, useWhiteboard } from "./hooks/useElements";

import { useKeyboard } from "./hooks/useKeyboard";
import { useWebcam } from "./hooks/useWebcam";
import { useCaptureSources } from "./hooks/useCaptureSource";
import { useMediaDevices } from "./hooks/useMediaDevices";
import { useRecording } from "./hooks/useRecording";
import { useSlides } from "./hooks/useSlides";
import { useAutoSave, loadAutoSave, clearAutoSave } from "./hooks/useAutoSave";
import type { BackgroundConfig } from "./hooks/useRecording";
import { Canvas } from "./components/Canvas";
import { Toolbar } from "./components/Toolbar";
import { ALL_FAVORITABLE, renderToolIcon } from "./constants/tools";
import { timestampFilename } from "./utils/format";
import { renderScene } from "./utils/renderer";
import { FloatingToolbar, loadFavorites, saveFavorites } from "./components/FloatingToolbar";
import { ContextMenu } from "./components/ContextMenu";
import { HamburgerMenu } from "./components/HamburgerMenu";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { WebcamOverlay } from "./components/WebcamOverlay";
import { CaptureOverlay } from "./components/CaptureOverlay";
import { MarkdownOverlay } from "./components/MarkdownOverlay";
import type { MarkdownPanelItem } from "./components/MarkdownOverlay";
import { RecordingControls } from "./components/RecordingControls";
import { SlidesPanel } from "./components/SlidesPanel";
import { Teleprompter } from "./components/Teleprompter";
import {
  RecordingSetupModal,
  webcamShapeProps,
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
} from "./components/RecordingSetupModal";
import type { WebcamShape, FrameRate } from "./components/RecordingSetupModal";
import { detectMindMapFormat, parseMindMapToMarkdown } from "./utils/mindmapParser";
import { exportSvg } from "./utils/svgExport";
import { LayerPanel } from "./components/LayerPanel";
import { WelcomeGuide, useWelcomeGuide } from "./components/WelcomeGuide";
import "./styles/index.css";

const captureMenuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '7px 14px',
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 13, color: '#333', textAlign: 'left',
};

function WhiteboardApp() {
  useKeyboard();
  const { showWelcome, dismissWelcome } = useWelcomeGuide();

  // Load saved settings (or defaults) on first render
  const [saved] = useState(loadSettings);

  const { videoRef, isWebcamOn, toggleWebcam } = useWebcam(saved.videoDeviceId || undefined);
  const capture = useCaptureSources();
  const { videoDevices: captureDeviceList } = useMediaDevices();
  const { isRecording, duration, startRecording, stopRecording } = useRecording();
  const { state: wbState, dispatch: wbDispatch } = useWhiteboard();
  const slides = useSlides();

  // Laser pointer overlay canvas (separate high-z layer)
  const laserCanvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-save to localStorage (debounced)
  useAutoSave(wbState.elements, slides.slides, wbState.viewport);

  // Restore auto-saved state on initial load
  useEffect(() => {
    const saved = loadAutoSave();
    if (saved) {
      wbDispatch({ type: "SET_ELEMENTS", elements: saved.elements });
      if (saved.viewport) {
        wbDispatch({ type: "SET_VIEWPORT", viewport: saved.viewport });
      }
      if (saved.slides && saved.slides.length > 0) {
        slides.loadSlides(saved.slides);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Keep laser canvas sized to viewport
  useEffect(() => {
    const resize = () => {
      const lc = laserCanvasRef.current;
      if (!lc) return;
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (lc.width !== Math.round(w * dpr) || lc.height !== Math.round(h * dpr)) {
        lc.width = Math.round(w * dpr);
        lc.height = Math.round(h * dpr);
        const ctx = lc.getContext("2d");
        if (ctx) { ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr, dpr); }
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Live refs for hi-res recording (always point to latest state)
  const elementsRef = useRef(wbState.elements);
  const viewportRef = useRef(wbState.viewport);
  useEffect(() => { elementsRef.current = wbState.elements; }, [wbState.elements]);
  useEffect(() => { viewportRef.current = wbState.viewport; }, [wbState.viewport]);

  // Teleprompter state
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  // Slides panel visibility
  const [showSlidesPanel, setShowSlidesPanel] = useState(false);
  // Layer panel visibility
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  // Recording settings state
  const [aspectRatio, setAspectRatio] = useState(saved.aspectRatio);
  const [background, setBackground] = useState<BackgroundConfig>(saved.background);
  const [canvasBorderRadius, setCanvasBorderRadius] = useState(saved.canvasBorderRadius);
  const [canvasPadding, setCanvasPadding] = useState(saved.canvasPadding);
  const [webcamShape, setWebcamShape] = useState<WebcamShape>(saved.webcamShape);
  const [webcamSize, setWebcamSize] = useState(saved.webcamSize);
  const [webcamCornerRadius, setWebcamCornerRadius] = useState(saved.webcamCornerRadius);
  const [webcamZoom, setWebcamZoom] = useState(saved.webcamZoom);
  const [videoDeviceId, setVideoDeviceId] = useState(saved.videoDeviceId);
  const [audioDeviceId, setAudioDeviceId] = useState(saved.audioDeviceId);
  const [cursorHighlight, setCursorHighlight] = useState(saved.cursorHighlight);
  const [cursorHighlightColor, setCursorHighlightColor] = useState(saved.cursorHighlightColor);
  const [cursorMagnify, setCursorMagnify] = useState(saved.cursorMagnify);
  const [cursorMagnifySize, setCursorMagnifySize] = useState(saved.cursorMagnifySize);
  const [resolution, setResolution] = useState(saved.resolution);
  const [frameRate, setFrameRate] = useState<FrameRate>(saved.frameRate);
  const [videoBitrate, setVideoBitrate] = useState(saved.videoBitrate);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [canvasBg, setCanvasBg] = useState("#ffffff");
  // Smart Zoom
  const [smartZoom, setSmartZoom] = useState(saved.smartZoom);
  const [smartZoomLevel, setSmartZoomLevel] = useState(saved.smartZoomLevel);
  const [smartZoomTransition, setSmartZoomTransition] = useState(saved.smartZoomTransition);
  const [smartZoomIdleDelay, setSmartZoomIdleDelay] = useState(saved.smartZoomIdleDelay);
  const [smartZoomDamping, setSmartZoomDamping] = useState(saved.smartZoomDamping);
  // Capture source settings
  const [captureSize, setCaptureSize] = useState(saved.captureSize);
  // Capture popup menu
  const [showCaptureMenu, setShowCaptureMenu] = useState(false);
  const captureMenuRef = useRef<HTMLDivElement>(null);

  // Mobile "more" menu for right toolbar
  const [showMobileMore, setShowMobileMore] = useState(false);
  const mobileMoreRef = useRef<HTMLDivElement>(null);

  // Hide properties panel on mobile when drawing on canvas
  const [propsPanelCollapsed, setPropsPanelCollapsed] = useState(false);

  // Close capture menu on outside click/touch
  useEffect(() => {
    if (!showCaptureMenu) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (captureMenuRef.current && !captureMenuRef.current.contains(e.target as Node)) {
        setShowCaptureMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showCaptureMenu]);

  // Close mobile more menu on outside click/touch
  useEffect(() => {
    if (!showMobileMore) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (mobileMoreRef.current && !mobileMoreRef.current.contains(e.target as Node)) {
        setShowMobileMore(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showMobileMore]);

  // ---- Markdown panels ----
  const [mdPanels, setMdPanels] = useState<MarkdownPanelItem[]>([]);
  let _mdCounter = useRef(0);

  const handleOpenMarkdown = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.txt,.xmind,.mm,.opml";
    input.multiple = true;
    input.onchange = async () => {
      const files = input.files;
      if (!files) return;
      const newPanels: MarkdownPanelItem[] = [];
      for (const file of Array.from(files)) {
        _mdCounter.current++;
        const isMindMap = detectMindMapFormat(file.name) !== null;
        let content: string;
        if (isMindMap) {
          try {
            content = await parseMindMapToMarkdown(file);
          } catch (err) {
            console.error("解析脑图失败:", err);
            content = `# 解析失败\n\n文件 \`${file.name}\` 无法解析。`;
          }
        } else {
          content = await file.text();
        }
        newPanels.push({
          id: crypto.randomUUID?.() ?? `md-${Date.now()}-${_mdCounter.current}`,
          fileName: file.name,
          content,
        });
      }
      setMdPanels((prev) => [...prev, ...newPanels]);
    };
    input.click();
  }, []);

  const handleCloseMarkdown = useCallback((id: string) => {
    setMdPanels((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Derive webcam overlay props from shape + corner radius
  const wcProps = webcamShapeProps(webcamShape, webcamCornerRadius);

  // Floating toolbar favorites
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number; toolKey: string; source: "toolbar" | "floating";
  } | null>(null);

  const addToFavorites = useCallback((key: string) => {
    setFavorites((prev) => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      saveFavorites(next);
      return next;
    });
  }, []);

  const removeFromFavorites = useCallback((key: string) => {
    setFavorites((prev) => {
      const next = prev.filter((k) => k !== key);
      saveFavorites(next);
      return next;
    });
  }, []);

  const handleToolbarContext = useCallback((e: React.MouseEvent, toolKey: string) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, toolKey, source: "toolbar" });
  }, []);

  const handleFloatingContext = useCallback((e: React.MouseEvent, toolKey: string) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, toolKey, source: "floating" });
  }, []);

  // ---- File handlers for HamburgerMenu ----

  const handleOpenFile = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        clearAutoSave(); // Clear auto-save since user is loading explicit file
        if (Array.isArray(data)) {
          // Legacy format: plain elements array
          wbDispatch({ type: "SET_ELEMENTS", elements: data });
          wbDispatch({ type: "RESET_VIEWPORT" });
          slides.clearSlides();
        } else if (data && Array.isArray(data.elements)) {
          // New format: { elements, slides?, viewport? }
          wbDispatch({ type: "SET_ELEMENTS", elements: data.elements });
          if (data.viewport) {
            wbDispatch({ type: "SET_VIEWPORT", viewport: data.viewport });
          } else {
            wbDispatch({ type: "RESET_VIEWPORT" });
          }
          if (Array.isArray(data.slides) && data.slides.length > 0) {
            slides.loadSlides(data.slides);
          } else {
            slides.clearSlides();
          }
        } else {
          alert("文件格式错误，无法打开");
        }
      } catch {
        alert("文件格式错误，无法打开");
      }
    };
    input.click();
  }, [wbDispatch, slides]);

  const handleSaveFile = useCallback(() => {
    const visible = wbState.elements.filter((el) => !el.isDeleted);
    const clean = visible.map((el) => {
      const { _roughDrawable, ...rest } = el;
      return rest;
    });
    // Save slides data alongside elements
    const cleanSlides = slides.slides.map((s) => ({
      ...s,
      elements: s.elements.map((el) => {
        const { _roughDrawable, ...rest } = el;
        return rest;
      }),
    }));
    const saveData = { elements: clean, slides: cleanSlides, viewport: wbState.viewport };
    const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.download = timestampFilename("whiteboard", "json");
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [wbState.elements, slides.slides]);

  const handleExportImage = useCallback(() => {
    // Render at identity viewport (no pan/zoom) for a clean export
    const staticCanvas = document.querySelector(
      ".canvas-frame canvas:first-child"
    ) as HTMLCanvasElement | null;
    if (!staticCanvas) return;

    const off = document.createElement("canvas");
    off.width = staticCanvas.width;
    off.height = staticCanvas.height;
    const offCtx = off.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    offCtx.scale(dpr, dpr);

    // Fill background
    offCtx.fillStyle = canvasBg;
    offCtx.fillRect(0, 0, off.width, off.height);

    // Render elements with identity viewport
    renderScene(off, wbState.elements, [], { panX: 0, panY: 0, zoom: 1 });

    const link = document.createElement("a");
    link.download = timestampFilename("whiteboard", "png");
    link.href = off.toDataURL("image/png");
    link.click();
  }, [canvasBg, wbState.elements]);

  const handleExportSvg = useCallback(() => {
    const svgStr = exportSvg(wbState.elements);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.download = timestampFilename("whiteboard", "svg");
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [wbState.elements]);

  // Wire up keyboard shortcut custom events
  useEffect(() => {
    const onOpen = () => handleOpenFile();
    const onSave = () => handleSaveFile();
    const onExport = () => handleExportImage();
    const onExportSvg = () => handleExportSvg();
    const onSlideNext = () => {
      const els = slides.nextSlide(wbState.elements);
      if (els) wbDispatch({ type: "SET_ELEMENTS", elements: els });
    };
    const onSlidePrev = () => {
      const els = slides.prevSlide(wbState.elements);
      if (els) wbDispatch({ type: "SET_ELEMENTS", elements: els });
    };
    window.addEventListener("wb:open-file", onOpen);
    window.addEventListener("wb:save-file", onSave);
    window.addEventListener("wb:export-image", onExport);
    window.addEventListener("wb:export-svg", onExportSvg);
    window.addEventListener("wb:slide-next", onSlideNext);
    window.addEventListener("wb:slide-prev", onSlidePrev);
    return () => {
      window.removeEventListener("wb:open-file", onOpen);
      window.removeEventListener("wb:save-file", onSave);
      window.removeEventListener("wb:export-image", onExport);
      window.removeEventListener("wb:export-svg", onExportSvg);
      window.removeEventListener("wb:slide-next", onSlideNext);
      window.removeEventListener("wb:slide-prev", onSlidePrev);
    };
  }, [handleOpenFile, handleSaveFile, handleExportImage, handleExportSvg, slides.nextSlide, slides.prevSlide]);

  // Start recording with current settings
  const handleStartRecording = useCallback(async () => {
    const staticCanvas = document.querySelector(
      ".canvas-frame canvas:first-child"
    ) as HTMLCanvasElement | null;
    const dynamicCanvas = document.querySelector(
      ".canvas-frame canvas:nth-child(2)"
    ) as HTMLCanvasElement | null;

    try {
      await startRecording({
        staticCanvas,
        dynamicCanvas,
        webcamVideo: videoRef.current,
        webcamBorderRadius: wcProps.borderRadius,
        webcamShapeType: wcProps.shapeType,
        webcamZoom,
        getCaptureVideos: capture.getAllVideoElements,
        background,
        canvasPadding,
        canvasBorderRadius,
        audioDeviceId: audioDeviceId || undefined,
        getCaptureStreams: capture.getStreams,
        cursorHighlight,
        cursorHighlightColor,
        cursorMagnify,
        cursorMagnifySize,
        resolution,
        frameRate,
        videoBitrate,
        smartZoom,
        smartZoomLevel,
        smartZoomTransition,
        smartZoomIdleDelay,
        smartZoomDamping,
      });
    } catch (err) {
      console.error("录制启动失败:", err);
    }
  }, [startRecording, videoRef, capture, wcProps.borderRadius, wcProps.shapeType, webcamZoom, background, canvasPadding, canvasBorderRadius, audioDeviceId, cursorHighlight, cursorHighlightColor, cursorMagnify, cursorMagnifySize, resolution, frameRate, videoBitrate, smartZoom, smartZoomLevel, smartZoomTransition, smartZoomIdleDelay, smartZoomDamping]);

  // Save current settings as defaults
  const handleSaveDefaults = useCallback(() => {
    saveSettings({
      aspectRatio,
      background,
      canvasBorderRadius,
      canvasPadding,
      webcamShape,
      webcamSize,
      webcamCornerRadius,
      webcamZoom,
      videoDeviceId,
      audioDeviceId,
      cursorHighlight,
      cursorHighlightColor,
      cursorMagnify,
      cursorMagnifySize,
      resolution,
      frameRate,
      videoBitrate,
      smartZoom,
      smartZoomLevel,
      smartZoomTransition,
      smartZoomIdleDelay,
      smartZoomDamping,
      captureSize,
    });
  }, [aspectRatio, background, canvasBorderRadius, canvasPadding, webcamShape, webcamSize, webcamCornerRadius, webcamZoom, videoDeviceId, audioDeviceId, cursorHighlight, cursorHighlightColor, cursorMagnify, cursorMagnifySize, resolution, frameRate, videoBitrate, smartZoom, smartZoomLevel, smartZoomTransition, smartZoomIdleDelay, smartZoomDamping, captureSize]);

  // Reset all settings to factory defaults
  const handleReset = useCallback(() => {
    const d = DEFAULT_SETTINGS;
    setAspectRatio(d.aspectRatio);
    setBackground(d.background);
    setCanvasBorderRadius(d.canvasBorderRadius);
    setCanvasPadding(d.canvasPadding);
    setWebcamShape(d.webcamShape);
    setWebcamSize(d.webcamSize);
    setWebcamCornerRadius(d.webcamCornerRadius);
    setWebcamZoom(d.webcamZoom);
    setVideoDeviceId(d.videoDeviceId);
    setAudioDeviceId(d.audioDeviceId);
    setCursorHighlight(d.cursorHighlight);
    setCursorHighlightColor(d.cursorHighlightColor);
    setCursorMagnify(d.cursorMagnify);
    setCursorMagnifySize(d.cursorMagnifySize);
    setResolution(d.resolution);
    setFrameRate(d.frameRate);
    setVideoBitrate(d.videoBitrate);
    setSmartZoom(d.smartZoom);
    setSmartZoomLevel(d.smartZoomLevel);
    setSmartZoomTransition(d.smartZoomTransition);
    setSmartZoomIdleDelay(d.smartZoomIdleDelay);
    setSmartZoomDamping(d.smartZoomDamping);
    setCaptureSize(d.captureSize);
  }, []);

  // Build context menu items
  const ctxMenuItems = ctxMenu
    ? (() => {
        const def = ALL_FAVORITABLE.find((t) => t.key === ctxMenu.toolKey);
        if (!def) return [];
        if (ctxMenu.source === "toolbar") {
          const isFav = favorites.includes(ctxMenu.toolKey);
          return isFav
            ? [{ label: `从浮动栏移除「${def.label}」`, onClick: () => removeFromFavorites(ctxMenu.toolKey) }]
            : [{ label: `添加「${def.label}」到浮动栏`, onClick: () => addToFavorites(ctxMenu.toolKey) }];
        } else {
          return [{ label: `从浮动栏移除「${def.label}」`, onClick: () => removeFromFavorites(ctxMenu.toolKey), danger: true }];
        }
      })()
    : [];

  return (
    <div className="app">
      <div className="toolbar-container">
        <HamburgerMenu
          canvasBg={canvasBg}
          onCanvasBgChange={setCanvasBg}
          onOpenFile={handleOpenFile}
          onSaveFile={handleSaveFile}
          onExportImage={handleExportImage}
          onExportSvg={handleExportSvg}
        />
        <div className="toolbar-left" onClick={() => setPropsPanelCollapsed(false)}>
          <Toolbar onContextMenu={handleToolbarContext} />
        </div>
        <div className="toolbar-right">
          {/* Desktop: show all buttons inline */}
          <div className="toolbar-right-desktop">
            <button
              className={`tool-btn ${showLayerPanel ? 'active' : ''}`}
              onClick={() => setShowLayerPanel(!showLayerPanel)}
              data-tooltip="图层"
            >
              {renderToolIcon("layers", "tool-icon")}
            </button>
            <button
              className={`tool-btn ${showSlidesPanel ? 'active' : ''}`}
              onClick={() => setShowSlidesPanel(!showSlidesPanel)}
              data-tooltip="幻灯片"
            >
              {renderToolIcon("slides", "tool-icon")}
            </button>
            <button
              className={`tool-btn ${mdPanels.length > 0 ? 'active' : ''}`}
              onClick={handleOpenMarkdown}
              title="打开 Markdown / 脑图文件"
            >
              {renderToolIcon("markdown", "tool-icon")}
              {mdPanels.length > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  width: 14, height: 14, borderRadius: '50%',
                  background: '#6c63ff', color: '#fff',
                  fontSize: 9, fontWeight: 700, lineHeight: '14px',
                  textAlign: 'center', pointerEvents: 'none',
                }}>{mdPanels.length}</span>
              )}
            </button>
            <button
              className={`tool-btn ${showTeleprompter ? 'active' : ''}`}
              onClick={() => setShowTeleprompter(!showTeleprompter)}
              title="提词器"
            >
              {renderToolIcon("teleprompter", "tool-icon")}
            </button>
            {/* Capture sources button + popup menu */}
            <div style={{ position: "relative" }} ref={captureMenuRef}>
              <button
                className={`tool-btn ${capture.sources.length > 0 ? 'active' : ''}`}
                onClick={() => setShowCaptureMenu(!showCaptureMenu)}
                title="采集源"
              >
                {renderToolIcon("capture", "tool-icon")}
                {capture.sources.length > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 14, height: 14, borderRadius: '50%',
                    background: '#e03131', color: '#fff',
                    fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1,
                  }}>{capture.sources.length}</span>
                )}
              </button>
              {showCaptureMenu && (
                <div className="capture-popup-menu" style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 6,
                  background: '#fff', borderRadius: 10,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.1)',
                  minWidth: 220, padding: '6px 0',
                  zIndex: 9999, fontSize: 13,
                }}>
                  <div style={{ padding: '6px 14px', fontWeight: 600, fontSize: 12, color: '#888', letterSpacing: 0.5 }}>添加采集</div>
                  <button
                    className="capture-menu-item"
                    disabled={capture.isFull}
                    onClick={() => { capture.addScreenCapture(); setShowCaptureMenu(false); }}
                    style={captureMenuItemStyle}
                  >
                    <svg width={14} height={14} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="16" height="11" rx="2" /><line x1="7" y1="17" x2="13" y2="17" /><line x1="10" y1="14" x2="10" y2="17" /></svg> 屏幕 / 窗口 / 标签页
                  </button>
                  {captureDeviceList.length > 0 && (
                    <>
                      <div style={{ padding: '6px 14px 2px', fontWeight: 600, fontSize: 12, color: '#888', letterSpacing: 0.5, marginTop: 4 }}>设备采集</div>
                      {captureDeviceList.map((d) => (
                        <button
                          key={d.deviceId}
                          className="capture-menu-item"
                          disabled={capture.isFull}
                          onClick={() => { capture.addDeviceCapture(d.deviceId, d.label); setShowCaptureMenu(false); }}
                          style={captureMenuItemStyle}
                        >
                          <svg width={14} height={14} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="12" height="10" rx="1.5" /><path d="M14 9l4-2v6l-4-2z" /></svg> {d.label}
                        </button>
                      ))}
                    </>
                  )}
                  {capture.sources.length > 0 && (
                    <>
                      <div style={{ height: 1, background: '#eee', margin: '6px 10px' }} />
                      <div style={{ padding: '4px 14px', fontWeight: 600, fontSize: 12, color: '#888', letterSpacing: 0.5 }}>当前采集 ({capture.sources.length}/4)</div>
                      {capture.sources.map((s) => (
                        <button
                          key={s.id}
                          className="capture-menu-item"
                          onClick={() => { capture.removeCapture(s.id); }}
                          style={captureMenuItemStyle}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4cd964', display: 'inline-block' }} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                          <span style={{ color: '#e03131', fontSize: 11, flexShrink: 0 }}>✕ 关闭</span>
                        </button>
                      ))}
                    </>
                  )}
                  {capture.isFull && (
                    <div style={{ padding: '4px 14px', fontSize: 11, color: '#e03131' }}>已达最大数量 (4)</div>
                  )}
                </div>
              )}
            </div>
            <div className="toolbar-divider" />
            <button
              className="tool-btn settings-btn"
              onClick={() => setShowSetupModal(true)}
              title="录制设置"
            >
              {renderToolIcon("settings", "tool-icon")}
            </button>
            <div className="toolbar-divider" />
            <RecordingControls
              isRecording={isRecording}
              duration={duration}
              onStart={handleStartRecording}
              onStop={stopRecording}
            />
          </div>

          {/* Mobile: "more" button with dropdown */}
          <div className="toolbar-mobile-more" ref={mobileMoreRef}>
            <button
              className="tool-btn"
              onClick={() => setShowMobileMore(!showMobileMore)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="4" cy="10" r="2" />
                <circle cx="10" cy="10" r="2" />
                <circle cx="16" cy="10" r="2" />
              </svg>
            </button>
            {showMobileMore && (
              <div className="mobile-more-menu">
                <button
                  className={`mobile-more-item ${showLayerPanel ? 'active' : ''}`}
                  onClick={() => { setShowLayerPanel(!showLayerPanel); setShowMobileMore(false); }}
                >
                  {renderToolIcon("layers", "tool-icon")}
                  <span>图层</span>
                </button>
                <button
                  className={`mobile-more-item ${showSlidesPanel ? 'active' : ''}`}
                  onClick={() => { setShowSlidesPanel(!showSlidesPanel); setShowMobileMore(false); }}
                >
                  {renderToolIcon("slides", "tool-icon")}
                  <span>幻灯片</span>
                </button>
                <button
                  className={`mobile-more-item ${mdPanels.length > 0 ? 'active' : ''}`}
                  onClick={() => { handleOpenMarkdown(); setShowMobileMore(false); }}
                >
                  {renderToolIcon("markdown", "tool-icon")}
                  <span>Markdown</span>
                </button>
                <button
                  className={`mobile-more-item ${showTeleprompter ? 'active' : ''}`}
                  onClick={() => { setShowTeleprompter(!showTeleprompter); setShowMobileMore(false); }}
                >
                  {renderToolIcon("teleprompter", "tool-icon")}
                  <span>提词器</span>
                </button>
                <div style={{ height: 1, background: '#eee', margin: '4px 10px' }} />
                <button
                  className="mobile-more-item"
                  onClick={() => { setShowSetupModal(true); setShowMobileMore(false); }}
                >
                  {renderToolIcon("settings", "tool-icon")}
                  <span>录制设置</span>
                </button>
                <button
                  className={`mobile-more-item ${isRecording ? 'active' : ''}`}
                  onClick={() => { isRecording ? stopRecording() : handleStartRecording(); setShowMobileMore(false); }}
                >
                  <span className="tool-icon" style={{ color: isRecording ? '#e03131' : undefined }}>
                    {isRecording ? '⏹' : '⏺'}
                  </span>
                  <span>{isRecording ? '停止录制' : '开始录制'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="whiteboard-container">
        <PropertiesPanel collapsed={propsPanelCollapsed} />
        <Canvas aspectRatio={aspectRatio} canvasBg={canvasBg} laserCanvas={laserCanvasRef} onInteract={() => setPropsPanelCollapsed(true)} />
        <div onClick={() => setPropsPanelCollapsed(false)}>
          <FloatingToolbar favorites={favorites} onContextMenu={handleFloatingContext} />
        </div>
        {showLayerPanel && <LayerPanel onClose={() => setShowLayerPanel(false)} />}
        {showSlidesPanel && (
          <SlidesPanel
            slides={slides.slides}
            currentIndex={slides.currentIndex}
            slidesEnabled={slides.slidesEnabled}
            onToggle={slides.setSlidesEnabled}
            onSaveAsSlide={() => {
              const visibleElements = wbState.elements.filter((el) => !el.isDeleted);
              if (visibleElements.length === 0) {
                alert("画板为空，请先绘制内容再保存为幻灯片");
                return;
              }
              slides.saveAsSlide(wbState.elements);
            }}
            onUpdateCurrentSlide={() => slides.updateCurrentSlide(wbState.elements)}
            onAddSlides={(files) => slides.addSlides(files)}
            onRemoveSlide={(i) => {
              const els = slides.removeSlide(i);
              if (els) wbDispatch({ type: "SET_ELEMENTS", elements: els });
            }}
            onClearSlides={slides.clearSlides}
            onAddBlankSlide={() => {
              const els = slides.addBlankSlide(wbState.elements);
              wbDispatch({ type: "SET_ELEMENTS", elements: els });
            }}
            onGoToSlide={(i) => {
              const els = slides.goToSlide(i, wbState.elements);
              if (els) wbDispatch({ type: "SET_ELEMENTS", elements: els });
            }}
            onRenameSlide={(i, name) => slides.renameSlide(i, name)}
            onReorderSlide={(from, to) => slides.reorderSlide(from, to)}
          />
        )}
      </div>

      <WebcamOverlay
        videoRef={videoRef}
        isOn={isWebcamOn}
        onClose={toggleWebcam}
        borderRadius={wcProps.borderRadius}
        aspectRatio={wcProps.aspectRatio}
        shapeType={wcProps.shapeType}
        initialWidth={webcamSize}
        zoom={webcamZoom}
      />

      {capture.sources.map((src, i) => (
        <CaptureOverlay
          key={src.id}
          sourceId={src.id}
          label={src.label}
          stream={src.stream}
          onClose={capture.removeCapture}
          registerVideoRef={capture.registerVideoRef}
          initialWidth={captureSize}
          stackIndex={i}
        />
      ))}

      {mdPanels.map((panel, i) => (
        <MarkdownOverlay
          key={panel.id}
          panel={panel}
          onClose={handleCloseMarkdown}
          stackIndex={i}
        />
      ))}

      {/* Laser pointer overlay — above MD/capture overlays, below webcam */}
      <canvas
        ref={laserCanvasRef}
        style={{
          position: 'fixed', top: 0, left: 0,
          width: '100vw', height: '100vh',
          zIndex: 5000,
          pointerEvents: 'none',
        }}
      />

      {showSetupModal && (
        <RecordingSetupModal
          isWebcamOn={isWebcamOn}
          onToggleWebcam={toggleWebcam}
          webcamShape={webcamShape}
          onWebcamShapeChange={setWebcamShape}
          webcamSize={webcamSize}
          onWebcamSizeChange={setWebcamSize}
          webcamCornerRadius={webcamCornerRadius}
          onWebcamCornerRadiusChange={setWebcamCornerRadius}
          webcamZoom={webcamZoom}
          onWebcamZoomChange={setWebcamZoom}
          captureSources={capture.sources}
          captureSize={captureSize}
          onCaptureSizeChange={setCaptureSize}
          onAddScreenCapture={capture.addScreenCapture}
          onAddDeviceCapture={capture.addDeviceCapture}
          onRemoveCapture={capture.removeCapture}
          captureIsFull={capture.isFull}
          aspectRatio={aspectRatio}
          onAspectRatioChange={setAspectRatio}
          background={background}
          onBackgroundChange={setBackground}
          canvasBorderRadius={canvasBorderRadius}
          onCanvasBorderRadiusChange={setCanvasBorderRadius}
          canvasPadding={canvasPadding}
          onCanvasPaddingChange={setCanvasPadding}
          videoDeviceId={videoDeviceId}
          onVideoDeviceChange={setVideoDeviceId}
          audioDeviceId={audioDeviceId}
          onAudioDeviceChange={setAudioDeviceId}
          cursorHighlight={cursorHighlight}
          onCursorHighlightChange={setCursorHighlight}
          cursorHighlightColor={cursorHighlightColor}
          onCursorHighlightColorChange={setCursorHighlightColor}
          cursorMagnify={cursorMagnify}
          onCursorMagnifyChange={setCursorMagnify}
          cursorMagnifySize={cursorMagnifySize}
          onCursorMagnifySizeChange={setCursorMagnifySize}
          smartZoom={smartZoom}
          onSmartZoomChange={setSmartZoom}
          smartZoomLevel={smartZoomLevel}
          onSmartZoomLevelChange={setSmartZoomLevel}
          smartZoomTransition={smartZoomTransition}
          onSmartZoomTransitionChange={setSmartZoomTransition}
          smartZoomIdleDelay={smartZoomIdleDelay}
          smartZoomDamping={smartZoomDamping}
          onSmartZoomDampingChange={setSmartZoomDamping}
          onSmartZoomIdleDelayChange={setSmartZoomIdleDelay}
          resolution={resolution}
          onResolutionChange={setResolution}
          frameRate={frameRate}
          onFrameRateChange={setFrameRate}
          videoBitrate={videoBitrate}
          onVideoBitrateChange={setVideoBitrate}
          onSaveDefaults={handleSaveDefaults}
          onReset={handleReset}
          onConfirm={() => setShowSetupModal(false)}
          onCancel={() => setShowSetupModal(false)}
        />
      )}

      {ctxMenu && ctxMenuItems.length > 0 && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenuItems}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Teleprompter overlay — DOM element, NOT in canvas compositing = not recorded */}
      {showTeleprompter && (
        <Teleprompter onClose={() => setShowTeleprompter(false)} />
      )}

      {showWelcome && <WelcomeGuide onClose={dismissWelcome} />}
    </div>
  );
}

export default function App() {
  return (
    <WhiteboardProvider>
      <WhiteboardApp />
    </WhiteboardProvider>
  );
}
