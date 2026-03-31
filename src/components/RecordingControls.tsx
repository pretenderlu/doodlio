import { renderToolIcon } from "../constants/tools";

interface RecordingControlsProps {
  isRecording: boolean;
  duration: number;
  onStart: () => void;
  onStop: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function RecordingControls({
  isRecording,
  duration,
  onStart,
  onStop,
}: RecordingControlsProps) {
  if (isRecording) {
    return (
      <div className="toolbar-group recording-active">
        <span className="recording-dot" />
        <span className="recording-time">{formatDuration(duration)}</span>
        <button className="tool-btn recording-stop" onClick={onStop} title="停止录制">
          {renderToolIcon("record-stop", "tool-icon")}
        </button>
      </div>
    );
  }

  return (
    <button className="tool-btn record-btn" onClick={onStart} title="开始录制">
      <span className="record-icon" />
      录制
    </button>
  );
}
