import { useState, useRef, useCallback, useEffect } from "react";

interface WebcamState {
  stream: MediaStream | null;
  isOn: boolean;
  error: string | null;
}

export function useWebcam(videoDeviceId?: string) {
  const [webcamState, setWebcamState] = useState<WebcamState>({
    stream: null,
    isOn: false,
    error: null,
  });
  const videoRef = useRef<HTMLVideoElement>(null);

  const startStream = useCallback(async (deviceId?: string) => {
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setWebcamState({ stream, isOn: true, error: null });
    } catch (err) {
      setWebcamState({
        stream: null,
        isOn: false,
        error: err instanceof Error ? err.message : "无法访问摄像头",
      });
    }
  }, []);

  const toggleWebcam = useCallback(async () => {
    if (webcamState.isOn && webcamState.stream) {
      // Turn off
      webcamState.stream.getTracks().forEach((track) => track.stop());
      setWebcamState({ stream: null, isOn: false, error: null });
      return;
    }

    // Turn on with specified device
    await startStream(videoDeviceId || undefined);
  }, [webcamState.isOn, webcamState.stream, videoDeviceId, startStream]);

  // Switch device when videoDeviceId changes while webcam is on
  useEffect(() => {
    if (!webcamState.isOn || !videoDeviceId) return;
    // Restart stream with new device
    webcamState.stream?.getTracks().forEach((track) => track.stop());
    startStream(videoDeviceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoDeviceId]);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = webcamState.stream;
    }
  }, [webcamState.stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      webcamState.stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    videoRef,
    isWebcamOn: webcamState.isOn,
    webcamError: webcamState.error,
    toggleWebcam,
    webcamStream: webcamState.stream,
  };
}
