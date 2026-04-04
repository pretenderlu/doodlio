import { useState, useCallback } from "react";
import {
  loadSettings, saveSettings, DEFAULT_SETTINGS,
} from "../utils/recordingSettings";
import type { RecordingSettings } from "../utils/recordingSettings";

/**
 * Manages all recording settings state.
 * Replaces 20+ individual useState calls in App.tsx.
 */
export function useRecordingSettings() {
  const [settings, setSettings] = useState<RecordingSettings>(loadSettings);

  const updateSettings = useCallback(<K extends keyof RecordingSettings>(
    key: K,
    value: RecordingSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const persistSettings = useCallback(() => {
    setSettings(current => {
      saveSettings(current);
      return current;
    });
  }, []);

  return { settings, updateSettings, setSettings, resetSettings, persistSettings };
}
