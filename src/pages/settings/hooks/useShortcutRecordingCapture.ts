import { useEffect } from "react";
import { useSettingsPageStore } from "../store";

export const useShortcutRecordingCapture = () => {
  const recordingRowKey = useSettingsPageStore((state) => state.recordingRowKey);

  useEffect(() => {
    if (!recordingRowKey) return;

    const handler = (event: KeyboardEvent) => {
      useSettingsPageStore.getState().captureRecording(event);
    };

    window.addEventListener("keydown", handler, { capture: true });

    return () => {
      window.removeEventListener("keydown", handler, { capture: true });
    };
  }, [recordingRowKey]);
};
