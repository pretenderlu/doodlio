import { useState, useEffect, useCallback } from "react";

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

/** Check if mediaDevices API is available (requires HTTPS or localhost) */
function hasMediaDevices(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices;
}

export function useMediaDevices() {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  const enumerate = useCallback(async () => {
    if (!hasMediaDevices()) return;
    try {
      // Request a temporary stream to get device labels (browsers hide labels without permission)
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => null);
      const devices = await navigator.mediaDevices.enumerateDevices();

      setVideoDevices(
        devices
          .filter((d) => d.kind === "videoinput")
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 4)}`, kind: d.kind }))
      );
      setAudioDevices(
        devices
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 4)}`, kind: d.kind }))
      );

      // Release the temporary stream
      tempStream?.getTracks().forEach((t) => t.stop());
    } catch {
      // Permission denied — leave lists empty
    }
  }, []);

  useEffect(() => {
    enumerate();

    if (!hasMediaDevices()) return;
    const handler = () => enumerate();
    navigator.mediaDevices.addEventListener("devicechange", handler);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handler);
  }, [enumerate]);

  return { videoDevices, audioDevices, refreshDevices: enumerate };
}
