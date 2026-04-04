import type { BackgroundConfig } from "../hooks/useRecording";

export type WebcamShape = "circle" | "square" | "rectangle" | "squircle";

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

export const FRAME_RATE_PRESETS = [24, 30, 60] as const;
export type FrameRate = typeof FRAME_RATE_PRESETS[number];

export interface BitrateLevel {
  label: string;
  value: number;
}

export const BITRATE_LEVELS: BitrateLevel[] = [
  { label: "低",   value: 2_500_000  },
  { label: "中",   value: 5_000_000  },
  { label: "高",   value: 8_000_000  },
  { label: "极高", value: 16_000_000 },
];

export interface SmartZoomSpeedPreset {
  label: string;
  value: number;
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
  webcamZoom: number;
  videoDeviceId: string;
  audioDeviceId: string;
  cursorHighlight: boolean;
  cursorHighlightColor: string;
  cursorMagnify: boolean;
  cursorMagnifySize: number;
  resolution: string;
  frameRate: FrameRate;
  videoBitrate: number;
  smartZoom: boolean;
  smartZoomLevel: number;
  smartZoomTransition: number;
  smartZoomIdleDelay: number;
  smartZoomDamping: number;
  captureSize: number;
}

export const DEFAULT_SETTINGS: RecordingSettings = {
  aspectRatio: "16 / 9",
  background: { type: "solid", color: "#ffffff" },
  canvasBorderRadius: 0,
  canvasPadding: 0,
  webcamShape: "circle",
  webcamSize: 200,
  webcamCornerRadius: 12,
  webcamZoom: 1.0,
  videoDeviceId: "",
  audioDeviceId: "",
  cursorHighlight: false,
  cursorHighlightColor: "#e03131",
  cursorMagnify: false,
  cursorMagnifySize: 1.5,
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

/** Derive webcam overlay props from shape + corner radius */
export function webcamShapeProps(shape: WebcamShape, cornerRadius: number) {
  return {
    borderRadius: shape === "circle" ? 50 : shape === "squircle" ? 0 : cornerRadius,
    aspectRatio: shape === "rectangle" ? 16 / 9 : 1,
    shapeType: shape,
  };
}
