import { renderToolIcon } from "../constants/tools";
import { useI18n } from "../i18n";

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
  const { t } = useI18n();
  if (isRecording) {
    return (
      <div className="toolbar-group recording-active">
        <span className="recording-dot" />
        <span className="recording-time">{formatDuration(duration)}</span>
        <button className="tool-btn recording-stop" onClick={onStop} title={t("app.stopRecording")}>
          {renderToolIcon("record-stop", "tool-icon")}
        </button>
      </div>
    );
  }

  return (
    <button className="tool-btn record-btn" onClick={onStart} title={t("app.startRecording")}>
      <span className="record-icon" />
      {t("app.startRecording")}
    </button>
  );
}
