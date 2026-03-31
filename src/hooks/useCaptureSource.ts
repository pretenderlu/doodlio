import { useState, useCallback, useEffect, useRef } from "react";

export type CaptureMode = "screen" | "device";

export interface CaptureSourceItem {
  id: string;
  type: CaptureMode;
  deviceId?: string;
  label: string;
  stream: MediaStream;
}

const MAX_SOURCES = 4;

let _sourceCounter = 0;

export function useCaptureSources() {
  const [sources, setSources] = useState<CaptureSourceItem[]>([]);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  // Always-current ref for use in recording closures
  const sourcesRef = useRef<CaptureSourceItem[]>([]);
  sourcesRef.current = sources;

  // Register a <video> element for a given source id
  const registerVideoRef = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) {
      videoRefs.current.set(id, el);
    } else {
      videoRefs.current.delete(id);
    }
  }, []);

  // Get the <video> element for a source
  const getVideoElement = useCallback((id: string) => {
    return videoRefs.current.get(id) ?? null;
  }, []);

  // Get ALL active video elements (for recording compositing — uses ref, always current)
  const getAllVideoElements = useCallback(() => {
    return Array.from(videoRefs.current.entries())
      .filter(([id]) => sourcesRef.current.some((s) => s.id === id))
      .map(([, el]) => el);
  }, []);

  // ---- Add screen capture (getDisplayMedia) ----
  const addScreenCapture = useCallback(async () => {
    if (sources.length >= MAX_SOURCES) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });

      _sourceCounter++;
      const id = crypto.randomUUID?.() ?? `cap-${Date.now()}-${_sourceCounter}`;
      const trackLabel = stream.getVideoTracks()[0]?.label ?? "";
      const label = trackLabel || `屏幕 ${_sourceCounter}`;

      const item: CaptureSourceItem = { id, type: "screen", label, stream };

      // Auto-remove when user clicks "Stop sharing"
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setSources((prev) => prev.filter((s) => s.id !== id));
      });

      setSources((prev) => [...prev, item]);
      return id;
    } catch (err) {
      // User cancelled — not an error
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      console.error("屏幕采集失败:", err);
    }
  }, [sources.length]);

  // ---- Add device capture (getUserMedia) ----
  const addDeviceCapture = useCallback(async (deviceId: string, deviceLabel?: string) => {
    if (sources.length >= MAX_SOURCES) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      _sourceCounter++;
      const id = crypto.randomUUID?.() ?? `cap-${Date.now()}-${_sourceCounter}`;
      const label = deviceLabel || stream.getVideoTracks()[0]?.label || `设备 ${_sourceCounter}`;

      const item: CaptureSourceItem = { id, type: "device", deviceId, label, stream };

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setSources((prev) => prev.filter((s) => s.id !== id));
      });

      setSources((prev) => [...prev, item]);
      return id;
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      console.error("设备采集失败:", err);
    }
  }, [sources.length]);

  // ---- Remove a specific source ----
  const removeCapture = useCallback((id: string) => {
    setSources((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) {
        target.stream.getTracks().forEach((t) => t.stop());
      }
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  // ---- Remove all sources ----
  const removeAll = useCallback(() => {
    setSources((prev) => {
      prev.forEach((s) => s.stream.getTracks().forEach((t) => t.stop()));
      return [];
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      sources.forEach((s) => s.stream.getTracks().forEach((t) => t.stop()));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get ALL active streams (for recording audio merge — uses ref, always current)
  const getStreams = useCallback(() => {
    return sourcesRef.current.map((s) => s.stream);
  }, []);

  return {
    sources,
    addScreenCapture,
    addDeviceCapture,
    removeCapture,
    removeAll,
    registerVideoRef,
    getVideoElement,
    getAllVideoElements,
    getStreams,
    isFull: sources.length >= MAX_SOURCES,
  };
}
