import { useState, useRef, useId } from "react";
import type { BackgroundConfig } from "../hooks/useRecording";
import type { CaptureSourceItem } from "../hooks/useCaptureSource";
import { useMediaDevices } from "../hooks/useMediaDevices";
import { generateSquircleSVGPath } from "../utils/squirclePath";

export type WebcamShape = "circle" | "square" | "rectangle" | "squircle";

// ---- Aspect ratio presets ----
const ASPECT_PRESETS = [
  { label: "16:9", sub: "YouTube",  value: "16 / 9" },
  { label: "4:3",  sub: "经典",     value: "4 / 3"  },
  { label: "3:4",  sub: "小红书",   value: "3 / 4"  },
  { label: "9:16", sub: "抖音",     value: "9 / 16" },
  { label: "1:1",  sub: "正方形",   value: "1 / 1"  },
];

// ---- Resolution presets ----
export interface ResolutionPreset {
  label: string;
  sub: string;
  width: number;
  height: number;
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { label: "720p",  sub: "高清",     width: 1280,  height: 720  },
  { label: "1080p", sub: "全高清",   width: 1920,  height: 1080 },
  { label: "2K",    sub: "超清",     width: 2560,  height: 1440 },
  { label: "4K",    sub: "极致",     width: 3840,  height: 2160 },
];

// ---- Frame rate presets ----
export const FRAME_RATE_PRESETS = [24, 30, 60] as const;
export type FrameRate = typeof FRAME_RATE_PRESETS[number];

// ---- Video bitrate presets ----
export interface BitrateLevel {
  label: string;
  value: number; // bps
}

export const BITRATE_LEVELS: BitrateLevel[] = [
  { label: "低",   value: 2_500_000  },
  { label: "中",   value: 5_000_000  },
  { label: "高",   value: 8_000_000  },
  { label: "极高", value: 16_000_000 },
];

// ---- Background presets ----
type BgCategory = "all" | "vibrant" | "soft" | "dark" | "nature";

interface BgPreset {
  id: string;
  cats: BgCategory[];
  bg: BackgroundConfig;
  css: string;
}

const BG_PRESETS: BgPreset[] = [
  // ── Vibrant (Apple-style multi-stop) ──
  { id: "sonoma-warm",  cats: ["all","vibrant"], bg: { type:"gradient", colors:["#FF6B35","#F7931E","#FFD700","#FF4757"], angle:135 }, css:"linear-gradient(135deg,#FF6B35,#F7931E,#FFD700,#FF4757)" },
  { id: "sonoma-cool",  cats: ["all","vibrant"], bg: { type:"gradient", colors:["#667eea","#764ba2","#f093fb"], angle:160 }, css:"linear-gradient(160deg,#667eea,#764ba2,#f093fb)" },
  { id: "aurora-burst", cats: ["all","vibrant"], bg: { type:"gradient", colors:["#00C9FF","#92FE9D","#FDFC47"], angle:135 }, css:"linear-gradient(135deg,#00C9FF,#92FE9D,#FDFC47)" },
  { id: "neon-dream",   cats: ["all","vibrant"], bg: { type:"gradient", colors:["#FC466B","#3F5EFB","#6C2BF7"], angle:220 }, css:"linear-gradient(220deg,#FC466B,#3F5EFB,#6C2BF7)" },
  { id: "sunrise",      cats: ["all","vibrant"], bg: { type:"gradient", colors:["#f12711","#f5af19","#f7d794"], angle:135 }, css:"linear-gradient(135deg,#f12711,#f5af19,#f7d794)" },
  { id: "berry-blend",  cats: ["all","vibrant"], bg: { type:"gradient", colors:["#8E2DE2","#4A00E0","#FE2EC8"], angle:200 }, css:"linear-gradient(200deg,#8E2DE2,#4A00E0,#FE2EC8)" },
  { id: "tropical",     cats: ["all","vibrant"], bg: { type:"gradient", colors:["#f9d423","#ff4e50","#fc913a"], angle:160 }, css:"linear-gradient(160deg,#f9d423,#ff4e50,#fc913a)" },
  { id: "ocean-wave",   cats: ["all","vibrant"], bg: { type:"gradient", colors:["#2193b0","#6dd5ed","#00d2ff"], angle:135 }, css:"linear-gradient(135deg,#2193b0,#6dd5ed,#00d2ff)" },
  { id: "candy-pop",    cats: ["all","vibrant"], bg: { type:"gradient", colors:["#ff6a88","#ff99ac","#a18cd1","#fbc2eb"], angle:135 }, css:"linear-gradient(135deg,#ff6a88,#ff99ac,#a18cd1,#fbc2eb)" },
  { id: "electric",     cats: ["all","vibrant"], bg: { type:"gradient", colors:["#4776E6","#8E54E9","#00DBDE"], angle:160 }, css:"linear-gradient(160deg,#4776E6,#8E54E9,#00DBDE)" },
  // ── Soft & Pastel ──
  { id: "lavender",     cats: ["all","soft"], bg: { type:"gradient", colors:["#e0c3fc","#8ec5fc","#d9afd9"], angle:160 }, css:"linear-gradient(160deg,#e0c3fc,#8ec5fc,#d9afd9)" },
  { id: "peach-rose",   cats: ["all","soft"], bg: { type:"gradient", colors:["#ffecd2","#fcb69f","#ff9a9e"], angle:135 }, css:"linear-gradient(135deg,#ffecd2,#fcb69f,#ff9a9e)" },
  { id: "mint-cream",   cats: ["all","soft"], bg: { type:"gradient", colors:["#d4fc79","#96e6a1","#84fab0"], angle:135 }, css:"linear-gradient(135deg,#d4fc79,#96e6a1,#84fab0)" },
  { id: "sakura",       cats: ["all","soft"], bg: { type:"gradient", colors:["#fce4ec","#f8bbd0","#f48fb1"], angle:180 }, css:"linear-gradient(180deg,#fce4ec,#f8bbd0,#f48fb1)" },
  { id: "sky-dream",    cats: ["all","soft"], bg: { type:"gradient", colors:["#a1c4fd","#c2e9fb","#e8f4f8"], angle:180 }, css:"linear-gradient(180deg,#a1c4fd,#c2e9fb,#e8f4f8)" },
  { id: "soft-iris",    cats: ["all","soft"], bg: { type:"gradient", colors:["#ddd6f3","#faaca8","#fbc2eb"], angle:135 }, css:"linear-gradient(135deg,#ddd6f3,#faaca8,#fbc2eb)" },
  { id: "white",        cats: ["all","soft"], bg: { type:"solid", color:"#ffffff" }, css:"#ffffff" },
  { id: "fog",          cats: ["all","soft"], bg: { type:"gradient", colors:["#f5f7fa","#c3cfe2","#e0e5ec"], angle:180 }, css:"linear-gradient(180deg,#f5f7fa,#c3cfe2,#e0e5ec)" },
  // ── Dark & Moody ──
  { id: "deep-space",   cats: ["all","dark"], bg: { type:"gradient", colors:["#000428","#004e92","#1a2980"], angle:160 }, css:"linear-gradient(160deg,#000428,#004e92,#1a2980)" },
  { id: "midnight",     cats: ["all","dark"], bg: { type:"gradient", colors:["#0f2027","#203a43","#2c5364"], angle:135 }, css:"linear-gradient(135deg,#0f2027,#203a43,#2c5364)" },
  { id: "dark-aurora",  cats: ["all","dark"], bg: { type:"gradient", colors:["#1a1a2e","#16213e","#0f3460","#533483"], angle:160 }, css:"linear-gradient(160deg,#1a1a2e,#16213e,#0f3460,#533483)" },
  { id: "ember",        cats: ["all","dark"], bg: { type:"gradient", colors:["#200122","#6f0000","#1a0000"], angle:135 }, css:"linear-gradient(135deg,#200122,#6f0000,#1a0000)" },
  { id: "obsidian",     cats: ["all","dark"], bg: { type:"gradient", colors:["#232526","#414345","#2d3436"], angle:200 }, css:"linear-gradient(200deg,#232526,#414345,#2d3436)" },
  { id: "dark-cosmos",  cats: ["all","dark"], bg: { type:"gradient", colors:["#0d0d2b","#231942","#5e548e","#9f86c0"], angle:135 }, css:"linear-gradient(135deg,#0d0d2b,#231942,#5e548e,#9f86c0)" },
  { id: "black",        cats: ["all","dark"], bg: { type:"solid", color:"#1a1a1a" }, css:"#1a1a1a" },
  { id: "navy",         cats: ["all","dark"], bg: { type:"solid", color:"#0f172a" }, css:"#0f172a" },
  // ── Nature ──
  { id: "forest-glow",  cats: ["all","nature"], bg: { type:"gradient", colors:["#134e5e","#71b280","#43e97b"], angle:160 }, css:"linear-gradient(160deg,#134e5e,#71b280,#43e97b)" },
  { id: "golden-hour",  cats: ["all","nature"], bg: { type:"gradient", colors:["#f7971e","#ffd200","#f093fb"], angle:135 }, css:"linear-gradient(135deg,#f7971e,#ffd200,#f093fb)" },
  { id: "coral-reef",   cats: ["all","nature"], bg: { type:"gradient", colors:["#ff9966","#ff5e62","#ff6b81"], angle:200 }, css:"linear-gradient(200deg,#ff9966,#ff5e62,#ff6b81)" },
  { id: "northern-sky", cats: ["all","nature"], bg: { type:"gradient", colors:["#a8edea","#fed6e3","#c3cfe2"], angle:180 }, css:"linear-gradient(180deg,#a8edea,#fed6e3,#c3cfe2)" },
  { id: "meadow",       cats: ["all","nature"], bg: { type:"gradient", colors:["#56ab2f","#a8e063","#dce35b"], angle:135 }, css:"linear-gradient(135deg,#56ab2f,#a8e063,#dce35b)" },
  { id: "ocean-depth",  cats: ["all","nature"], bg: { type:"gradient", colors:["#0052D4","#4364F7","#6FB1FC"], angle:180 }, css:"linear-gradient(180deg,#0052D4,#4364F7,#6FB1FC)" },
];

const BG_CATEGORIES: { id: BgCategory; label: string }[] = [
  { id: "all",     label: "全部" },
  { id: "vibrant", label: "鲜艳" },
  { id: "soft",    label: "柔和" },
  { id: "dark",    label: "深色" },
  { id: "nature",  label: "自然" },
];

function bgMatch(a: BackgroundConfig, b: BackgroundConfig): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "solid" && b.type === "solid") return a.color === b.color;
  if (a.type === "gradient" && b.type === "gradient")
    return a.colors.join() === b.colors.join() && a.angle === b.angle;
  return false;
}

function parseAspectRatio(value: string): number {
  const parts = value.split("/").map((s) => parseFloat(s.trim()));
  return parts[0] / parts[1];
}

/** Derive webcam overlay props from shape + corner radius */
export function webcamShapeProps(shape: WebcamShape, cornerRadius: number) {
  return {
    borderRadius: shape === "circle" ? 50 : shape === "squircle" ? 0 : cornerRadius,
    aspectRatio: shape === "rectangle" ? 16 / 9 : 1,
    shapeType: shape,
  };
}

// ---- Settings persistence ----
// ---- Smart Zoom transition speed presets ----
export interface SmartZoomSpeedPreset {
  label: string;
  value: number; // ms
}

export const SMART_ZOOM_SPEED_PRESETS: SmartZoomSpeedPreset[] = [
  { label: "快",   value: 300  },
  { label: "中",   value: 600  },
  { label: "慢",   value: 1000 },
];

export interface RecordingSettings {
  aspectRatio: string;
  background: BackgroundConfig;
  canvasBorderRadius: number;
  canvasPadding: number;
  webcamShape: WebcamShape;
  webcamSize: number;
  webcamCornerRadius: number;
  videoDeviceId: string;
  audioDeviceId: string;
  cursorHighlight: boolean;
  cursorHighlightColor: string;
  resolution: string; // e.g. "1920x1080"
  frameRate: FrameRate;
  videoBitrate: number; // bps
  // Smart Zoom
  smartZoom: boolean;
  smartZoomLevel: number;        // e.g. 1.5
  smartZoomTransition: number;   // ms
  smartZoomIdleDelay: number;    // ms
  smartZoomDamping: number;      // 0.01-0.15, lower = smoother
  // Capture source
  captureSize: number;             // overlay width in px
}

export const DEFAULT_SETTINGS: RecordingSettings = {
  aspectRatio: "16 / 9",
  background: { type: "solid", color: "#ffffff" },
  canvasBorderRadius: 0,
  canvasPadding: 0,
  webcamShape: "circle",
  webcamSize: 200,
  webcamCornerRadius: 12,
  videoDeviceId: "",
  audioDeviceId: "",
  cursorHighlight: false,
  cursorHighlightColor: "#e03131",
  resolution: "1920x1080",
  frameRate: 30,
  videoBitrate: 8_000_000,
  smartZoom: false,
  smartZoomLevel: 1.5,
  smartZoomTransition: 800,
  smartZoomIdleDelay: 1500,
  smartZoomDamping: 0.03,
  captureSize: 400,
};

const STORAGE_KEY = "whiteboard-recording-settings";

export function loadSettings(): RecordingSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.warn("Failed to load recording settings:", e);
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: RecordingSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// ---- Preview ----
interface PreviewProps {
  aspectRatio: string;
  background: BackgroundConfig;
  canvasPadding: number;
  canvasBorderRadius: number;
  isWebcamOn: boolean;
  webcamShape: WebcamShape;
  webcamCornerRadius: number;
  captureCount: number;
}

function RecordingPreview({
  aspectRatio,
  background,
  canvasPadding,
  canvasBorderRadius,
  isWebcamOn,
  webcamShape,
  webcamCornerRadius,
  captureCount,
}: PreviewProps) {
  const ar = parseAspectRatio(aspectRatio);
  const maxW = 200;
  const maxH = 180;
  let fw: number, fh: number;
  if (ar >= maxW / maxH) {
    fw = maxW;
    fh = maxW / ar;
  } else {
    fh = maxH;
    fw = maxH * ar;
  }

  const bgCss =
    background.type === "solid"
      ? background.color
      : `linear-gradient(${background.angle}deg, ${background.colors.join(",")})`;

  const scale = fw / 800;
  const previewPad = Math.round(canvasPadding * scale * 3);
  const previewRadius = Math.round(canvasBorderRadius * scale * 3);

  // Webcam preview
  const isRect = webcamShape === "rectangle";
  const wcW = isRect ? 36 : 28;
  const wcH = isRect ? 20 : 28;
  const isSquircle = webcamShape === "squircle";
  const wcRadius =
    webcamShape === "circle"
      ? "50%"
      : isSquircle
        ? undefined
        : `${Math.round(Math.min(wcW, wcH) * (webcamCornerRadius / 100))}px`;

  const previewClipId = useId();

  return (
    <div className="rsetup-preview-wrap">
      <div className="rsetup-preview-label">预览</div>
      <div
        className="rsetup-preview-frame"
        style={{
          width: fw,
          height: fh,
          background: bgCss,
          borderRadius: 6,
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: previewPad,
            borderRadius: previewRadius,
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12% 15%", display: "flex", flexDirection: "column", gap: 5 }}>
            {[70, 55, 40].map((w, i) => (
              <div
                key={i}
                style={{ height: 4, width: `${w}%`, background: "#e0e0e0", borderRadius: 2 }}
              />
            ))}
          </div>
        </div>
        {isWebcamOn && (
          <>
            {isSquircle && (
              <svg width={0} height={0} style={{ position: "absolute" }}>
                <defs>
                  <clipPath id={previewClipId} clipPathUnits="objectBoundingBox">
                    <path d={generateSquircleSVGPath(1, 1)} />
                  </clipPath>
                </defs>
              </svg>
            )}
            <div
              style={{
                position: "absolute",
                bottom: previewPad + 6,
                right: previewPad + 6,
                width: wcW,
                height: wcH,
                borderRadius: wcRadius,
                clipPath: isSquircle ? `url(#${previewClipId})` : undefined,
                background: "#555",
                border: isSquircle ? undefined : "2px solid rgba(255,255,255,0.6)",
                boxShadow: isSquircle ? undefined : "0 2px 8px rgba(0,0,0,0.3)",
                filter: isSquircle ? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" : undefined,
              }}
            />
          </>
        )}
        {captureCount > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: previewPad + 6,
              left: previewPad + 6,
              width: 44,
              height: 26,
              borderRadius: 4,
              background: "#333",
              border: "2px solid rgba(255,255,255,0.6)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4cd964" }} />
          </div>
        )}
      </div>
    </div>
  );
}

const CURSOR_COLORS = ["#e03131", "#f08c00", "#f7c948", "#2f9e44", "#1971c2", "#9c36b5", "#e64980"];

// ---- Main modal ----
interface Props {
  isWebcamOn: boolean;
  onToggleWebcam: () => void;
  webcamShape: WebcamShape;
  onWebcamShapeChange: (s: WebcamShape) => void;
  webcamSize: number;
  onWebcamSizeChange: (v: number) => void;
  webcamCornerRadius: number;
  onWebcamCornerRadiusChange: (v: number) => void;
  captureSources: CaptureSourceItem[];
  captureSize: number;
  onCaptureSizeChange: (v: number) => void;
  onAddScreenCapture: () => void;
  onAddDeviceCapture: (deviceId: string, label?: string) => void;
  onRemoveCapture: (id: string) => void;
  captureIsFull: boolean;
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
  background: BackgroundConfig;
  onBackgroundChange: (bg: BackgroundConfig) => void;
  canvasBorderRadius: number;
  onCanvasBorderRadiusChange: (v: number) => void;
  canvasPadding: number;
  onCanvasPaddingChange: (v: number) => void;
  videoDeviceId: string;
  onVideoDeviceChange: (id: string) => void;
  audioDeviceId: string;
  onAudioDeviceChange: (id: string) => void;
  cursorHighlight: boolean;
  onCursorHighlightChange: (v: boolean) => void;
  cursorHighlightColor: string;
  onCursorHighlightColorChange: (c: string) => void;
  smartZoom: boolean;
  onSmartZoomChange: (v: boolean) => void;
  smartZoomLevel: number;
  onSmartZoomLevelChange: (v: number) => void;
  smartZoomTransition: number;
  onSmartZoomTransitionChange: (v: number) => void;
  smartZoomIdleDelay: number;
  onSmartZoomIdleDelayChange: (v: number) => void;
  smartZoomDamping: number;
  onSmartZoomDampingChange: (v: number) => void;
  resolution: string;
  onResolutionChange: (v: string) => void;
  frameRate: FrameRate;
  onFrameRateChange: (v: FrameRate) => void;
  videoBitrate: number;
  onVideoBitrateChange: (v: number) => void;
  onSaveDefaults: () => void;
  onReset: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RecordingSetupModal({
  isWebcamOn,
  onToggleWebcam,
  webcamShape,
  onWebcamShapeChange,
  webcamSize,
  onWebcamSizeChange,
  webcamCornerRadius,
  onWebcamCornerRadiusChange,
  captureSources,
  captureSize,
  onCaptureSizeChange,
  onAddScreenCapture,
  onAddDeviceCapture,
  onRemoveCapture,
  captureIsFull,
  aspectRatio,
  onAspectRatioChange,
  background,
  onBackgroundChange,
  canvasBorderRadius,
  onCanvasBorderRadiusChange,
  canvasPadding,
  onCanvasPaddingChange,
  videoDeviceId,
  onVideoDeviceChange,
  audioDeviceId,
  onAudioDeviceChange,
  cursorHighlight,
  onCursorHighlightChange,
  cursorHighlightColor,
  onCursorHighlightColorChange,
  smartZoom,
  onSmartZoomChange,
  smartZoomLevel,
  onSmartZoomLevelChange,
  smartZoomTransition,
  onSmartZoomTransitionChange,
  smartZoomIdleDelay,
  onSmartZoomIdleDelayChange,
  smartZoomDamping,
  onSmartZoomDampingChange,
  resolution,
  onResolutionChange,
  frameRate,
  onFrameRateChange,
  videoBitrate,
  onVideoBitrateChange,
  onSaveDefaults,
  onReset,
  onConfirm,
  onCancel,
}: Props) {
  const [bgCategory, setBgCategory] = useState<BgCategory>("all");
  const customColorRef = useRef<HTMLInputElement>(null);
  const { videoDevices, audioDevices } = useMediaDevices();

  const bitrateIndex = BITRATE_LEVELS.findIndex((b) => b.value === videoBitrate);
  const currentBitrateLabel = bitrateIndex >= 0 ? BITRATE_LEVELS[bitrateIndex].label : "自定义";

  const filteredPresets = BG_PRESETS.filter((p) => p.cats.includes(bgCategory));
  const isCustom = !BG_PRESETS.some((p) => bgMatch(p.bg, background));
  const customColor =
    background.type === "solid" && isCustom ? background.color : "#4a90d9";

  const randomBg = () => {
    const pool = filteredPresets.length > 0 ? filteredPresets : BG_PRESETS;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    onBackgroundChange(pick.bg);
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="rsetup-modal">
        {/* ── Left panel: preview ── */}
        <div className="rsetup-left">
          <RecordingPreview
            aspectRatio={aspectRatio}
            background={background}
            canvasPadding={canvasPadding}
            canvasBorderRadius={canvasBorderRadius}
            isWebcamOn={isWebcamOn}
            webcamShape={webcamShape}
            webcamCornerRadius={webcamCornerRadius}
            captureCount={captureSources.length}
          />
        </div>

        {/* ── Right panel: settings ── */}
        <div className="rsetup-right">
          <div className="rsetup-header">
            <span className="rsetup-title">录制设置</span>
            <button className="rsetup-close" onClick={onCancel}>✕</button>
          </div>

          <div className="rsetup-body">

            {/* Aspect ratio */}
            <div className="rsetup-section">
              <div className="rsetup-section-label">画面比例</div>
              <div className="rsetup-aspect-grid">
                {ASPECT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    className={`rsetup-aspect-card ${aspectRatio === preset.value ? "active" : ""}`}
                    onClick={() => onAspectRatioChange(preset.value)}
                  >
                    <span className="rsetup-aspect-ratio">{preset.label}</span>
                    <span className="rsetup-aspect-sub">{preset.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Video quality: resolution + framerate + bitrate */}
            <div className="rsetup-section">
              <div className="rsetup-section-label">视频质量</div>

              {/* Resolution */}
              <div className="rsetup-sub-label">分辨率</div>
              <div className="rsetup-aspect-grid rsetup-res-grid">
                {RESOLUTION_PRESETS.map((preset) => {
                  const key = `${preset.width}x${preset.height}`;
                  return (
                    <button
                      key={key}
                      className={`rsetup-aspect-card ${resolution === key ? "active" : ""}`}
                      onClick={() => onResolutionChange(key)}
                    >
                      <span className="rsetup-aspect-ratio">{preset.label}</span>
                      <span className="rsetup-aspect-sub">{preset.sub}</span>
                    </button>
                  );
                })}
              </div>

              {/* Frame rate */}
              <div className="rsetup-sub-label" style={{ marginTop: 14 }}>帧率</div>
              <div className="rsetup-shape-btns rsetup-shape-btns-3">
                {FRAME_RATE_PRESETS.map((fps) => (
                  <button
                    key={fps}
                    className={`rsetup-shape-btn ${frameRate === fps ? "active" : ""}`}
                    onClick={() => onFrameRateChange(fps)}
                  >
                    {fps} fps
                  </button>
                ))}
              </div>

              {/* Bitrate / quality */}
              <div className="rsetup-sub-label" style={{ marginTop: 14 }}>
                画质：<span className="rsetup-value">{currentBitrateLabel}</span>
              </div>
              <input
                type="range"
                min={0}
                max={BITRATE_LEVELS.length - 1}
                step={1}
                value={bitrateIndex >= 0 ? bitrateIndex : 2}
                onChange={(e) => onVideoBitrateChange(BITRATE_LEVELS[Number(e.target.value)].value)}
                className="rsetup-slider"
              />
              <div className="rsetup-range-labels">
                {BITRATE_LEVELS.map((b) => (
                  <span key={b.value}>{b.label}</span>
                ))}
              </div>
            </div>

            {/* Background */}
            <div className="rsetup-section">
              <div className="rsetup-section-label">背景</div>
              <div className="rsetup-bg-tabs">
                {BG_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    className={`rsetup-bg-tab ${bgCategory === cat.id ? "active" : ""}`}
                    onClick={() => setBgCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <button className="rsetup-random-btn" onClick={randomBg}>
                ✨ 随机选择壁纸
              </button>
              <div className="rsetup-bg-grid">
                {filteredPresets.map((preset) => (
                  <button
                    key={preset.id}
                    className={`rsetup-bg-swatch ${bgMatch(preset.bg, background) ? "active" : ""}`}
                    style={{ background: preset.css }}
                    onClick={() => onBackgroundChange(preset.bg)}
                  />
                ))}
                <button
                  className={`rsetup-bg-swatch rsetup-bg-custom ${isCustom ? "active" : ""}`}
                  onClick={() => customColorRef.current?.click()}
                  title="自定义颜色"
                />
                <input
                  ref={customColorRef}
                  type="color"
                  value={customColor}
                  onChange={(e) =>
                    onBackgroundChange({ type: "solid", color: e.target.value })
                  }
                  style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
                />
              </div>
            </div>

            {/* Canvas border radius */}
            <div className="rsetup-section">
              <div className="rsetup-section-label">
                圆角半径：<span className="rsetup-value">{canvasBorderRadius}PX</span>
              </div>
              <input
                type="range" min={0} max={50} value={canvasBorderRadius}
                onChange={(e) => onCanvasBorderRadiusChange(Number(e.target.value))}
                className="rsetup-slider"
              />
              <div className="rsetup-range-labels"><span>直角</span><span>圆角</span></div>
            </div>

            {/* Canvas padding */}
            <div className="rsetup-section">
              <div className="rsetup-section-label">
                画布边距：<span className="rsetup-value">{canvasPadding}PX</span>
              </div>
              <input
                type="range" min={0} max={120} value={canvasPadding}
                onChange={(e) => onCanvasPaddingChange(Number(e.target.value))}
                className="rsetup-slider"
              />
              <div className="rsetup-range-labels"><span>无</span><span>大</span></div>
            </div>

            {/* Webcam */}
            <div className="rsetup-section">
              <div className="rsetup-section-label">摄像头</div>
              <div className="rsetup-toggle-row">
                <span className="rsetup-toggle-label">录制时显示摄像头画面</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={isWebcamOn} onChange={() => onToggleWebcam()} />
                  <span className="toggle-slider" />
                </label>
              </div>

              {isWebcamOn && (
                <>
                  <div className="rsetup-section-label" style={{ marginTop: 14 }}>
                    大小：<span className="rsetup-value">{webcamSize}px</span>
                  </div>
                  <input
                    type="range" min={80} max={400} value={webcamSize}
                    onChange={(e) => onWebcamSizeChange(Number(e.target.value))}
                    className="rsetup-slider"
                  />
                  <div className="rsetup-range-labels"><span>小</span><span>大</span></div>

                  <div className="rsetup-section-label" style={{ marginTop: 14 }}>形状</div>
                  <div className="rsetup-shape-btns rsetup-shape-btns-4">
                    <button
                      className={`rsetup-shape-btn ${webcamShape === "rectangle" ? "active" : ""}`}
                      onClick={() => onWebcamShapeChange("rectangle")}
                    >
                      ▬ 长方形
                    </button>
                    <button
                      className={`rsetup-shape-btn ${webcamShape === "square" ? "active" : ""}`}
                      onClick={() => onWebcamShapeChange("square")}
                    >
                      □ 正方形
                    </button>
                    <button
                      className={`rsetup-shape-btn ${webcamShape === "circle" ? "active" : ""}`}
                      onClick={() => onWebcamShapeChange("circle")}
                    >
                      ○ 圆形
                    </button>
                    <button
                      className={`rsetup-shape-btn ${webcamShape === "squircle" ? "active" : ""}`}
                      onClick={() => onWebcamShapeChange("squircle")}
                    >
                      ◼ 超椭圆
                    </button>
                  </div>

                  {/* Corner radius slider for non-circle and non-squircle shapes */}
                  {webcamShape !== "circle" && webcamShape !== "squircle" && (
                    <>
                      <div className="rsetup-section-label" style={{ marginTop: 14 }}>
                        边框圆角：<span className="rsetup-value">{webcamCornerRadius}%</span>
                      </div>
                      <input
                        type="range" min={0} max={50} value={webcamCornerRadius}
                        onChange={(e) => onWebcamCornerRadiusChange(Number(e.target.value))}
                        className="rsetup-slider"
                      />
                      <div className="rsetup-range-labels"><span>直角</span><span>圆角</span></div>
                    </>
                  )}

                  {/* Camera device selector */}
                  {videoDevices.length > 0 && (
                    <>
                      <div className="rsetup-section-label" style={{ marginTop: 14 }}>摄像头设备</div>
                      <select
                        className="rsetup-device-select"
                        value={videoDeviceId}
                        onChange={(e) => onVideoDeviceChange(e.target.value)}
                      >
                        <option value="">默认</option>
                        {videoDevices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                        ))}
                      </select>
                    </>
                  )}

                  {/* Microphone selector */}
                  {audioDevices.length > 0 && (
                    <>
                      <div className="rsetup-section-label" style={{ marginTop: 14 }}>麦克风设备</div>
                      <select
                        className="rsetup-device-select"
                        value={audioDeviceId}
                        onChange={(e) => onAudioDeviceChange(e.target.value)}
                      >
                        <option value="">默认</option>
                        {audioDevices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                        ))}
                      </select>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Capture source */}
            <div className="rsetup-section">
              <div className="rsetup-section-label">采集源</div>

              {/* Quick-add buttons */}
              <div className="rsetup-shape-btns" style={{ marginBottom: 10 }}>
                <button
                  className="rsetup-shape-btn"
                  disabled={captureIsFull}
                  onClick={() => onAddScreenCapture()}
                >
                  🖥 屏幕采集
                </button>
                <button
                  className="rsetup-shape-btn"
                  disabled={captureIsFull || videoDevices.length === 0}
                  onClick={() => {
                    if (videoDevices.length > 0) onAddDeviceCapture(videoDevices[0].deviceId, videoDevices[0].label);
                  }}
                >
                  📹 设备采集
                </button>
              </div>

              {/* Active sources list */}
              {captureSources.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {captureSources.map((src) => (
                    <div key={src.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', background: '#f5f5f5',
                      borderRadius: 8, fontSize: 12,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4cd964', flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {src.type === 'screen' ? '🖥' : '📹'} {src.label}
                      </span>
                      <button
                        onClick={() => onRemoveCapture(src.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#e03131', fontSize: 11, fontWeight: 600,
                          padding: '2px 6px', borderRadius: 4,
                        }}
                      >✕ 关闭</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#aaa', padding: '6px 0' }}>
                  暂无活跃采集源。点击上方按钮添加，或使用工具栏㌀采集㌁按钮。
                </div>
              )}

              {captureSources.length > 0 && (
                <>
                  <div className="rsetup-section-label" style={{ marginTop: 14 }}>
                    默认大小：<span className="rsetup-value">{captureSize}px</span>
                  </div>
                  <input
                    type="range" min={160} max={800} value={captureSize}
                    onChange={(e) => onCaptureSizeChange(Number(e.target.value))}
                    className="rsetup-slider"
                  />
                  <div className="rsetup-range-labels"><span>小</span><span>大</span></div>
                </>
              )}

              {captureIsFull && (
                <div style={{ fontSize: 11, color: '#e03131', marginTop: 6 }}>已达最大数量 (4)</div>
              )}

              <div style={{ marginTop: 10, fontSize: 12, color: '#888', lineHeight: 1.5 }}>
                💡 采集的画面将显示为浮动窗口，可拖拽调整位置。录制时会自动合成到视频中。
              </div>
            </div>

            {/* Cursor highlight */}
            <div className="rsetup-section">
              <div className="rsetup-section-label">鼠标光标效果</div>
              <div className="rsetup-toggle-row">
                <span className="rsetup-toggle-label">录制时显示光标高亮</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={cursorHighlight} onChange={(e) => onCursorHighlightChange(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              {cursorHighlight && (
                <>
                  <div className="rsetup-section-label" style={{ marginTop: 10 }}>光标颜色</div>
                  <div className="rsetup-cursor-colors">
                    {CURSOR_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`rsetup-cursor-dot ${cursorHighlightColor === c ? "active" : ""}`}
                        style={{ background: c }}
                        onClick={() => onCursorHighlightColorChange(c)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Smart Zoom */}
            <div className="rsetup-section">
              <div className="rsetup-section-label">智能缩放</div>
              <div className="rsetup-toggle-row">
                <span className="rsetup-toggle-label">录制时自动聚焦到鼠标操作区域</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={smartZoom} onChange={(e) => onSmartZoomChange(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              {smartZoom && (
                <>
                  <div className="rsetup-section-label" style={{ marginTop: 14 }}>
                    缩放倍率：<span className="rsetup-value">{smartZoomLevel.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range" min={1.2} max={3.0} step={0.1} value={smartZoomLevel}
                    onChange={(e) => onSmartZoomLevelChange(Number(e.target.value))}
                    className="rsetup-slider"
                  />
                  <div className="rsetup-range-labels"><span>微缩</span><span>特写</span></div>

                  <div className="rsetup-section-label" style={{ marginTop: 14 }}>
                    过渡速度：<span className="rsetup-value">
                      {SMART_ZOOM_SPEED_PRESETS.find(p => p.value === smartZoomTransition)?.label ?? `${smartZoomTransition}ms`}
                    </span>
                  </div>
                  <div className="rsetup-shape-btns rsetup-shape-btns-3">
                    {SMART_ZOOM_SPEED_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        className={`rsetup-shape-btn ${smartZoomTransition === preset.value ? "active" : ""}`}
                        onClick={() => onSmartZoomTransitionChange(preset.value)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="rsetup-section-label" style={{ marginTop: 14 }}>
                    回退延迟：<span className="rsetup-value">{(smartZoomIdleDelay / 1000).toFixed(1)}s</span>
                  </div>
                  <input
                    type="range" min={500} max={3000} step={100} value={smartZoomIdleDelay}
                    onChange={(e) => onSmartZoomIdleDelayChange(Number(e.target.value))}
                    className="rsetup-slider"
                  />
                  <div className="rsetup-range-labels"><span>快速回退</span><span>长时间保持</span></div>

                  <div className="rsetup-section-label" style={{ marginTop: 14 }}>
                    跟随灵敏度：<span className="rsetup-value">
                      {smartZoomDamping <= 0.02 ? "极柔" : smartZoomDamping <= 0.04 ? "柔和" : smartZoomDamping <= 0.08 ? "适中" : "灵敏"}
                    </span>
                  </div>
                  <input
                    type="range" min={0.01} max={0.15} step={0.01} value={smartZoomDamping}
                    onChange={(e) => onSmartZoomDampingChange(Number(e.target.value))}
                    className="rsetup-slider"
                  />
                  <div className="rsetup-range-labels"><span>极柔（几乎不晃）</span><span>灵敏（紧跟鼠标）</span></div>
                </>
              )}
            </div>

          </div>{/* /rsetup-body */}

          {/* Footer */}
          <div className="rsetup-footer">
            <div className="rsetup-footer-actions">
              <button className="rsetup-btn-secondary" onClick={onReset}>重置</button>
              <button className="rsetup-btn-secondary" onClick={onSaveDefaults}>保存为默认</button>
            </div>
            <button className="rsetup-confirm" onClick={onConfirm}>完成</button>
          </div>
        </div>
      </div>
    </div>
  );
}
