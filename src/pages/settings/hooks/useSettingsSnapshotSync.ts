import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { SettingsSnapshot } from "@/types/settings";

interface UseSettingsSnapshotSyncParams {
  load: () => Promise<void>;
  applySnapshot: (snapshot: SettingsSnapshot) => void;
  onLoadError: (error: unknown) => void;
}

export const useSettingsSnapshotSync = ({
  load,
  applySnapshot,
  onLoadError,
}: UseSettingsSnapshotSyncParams) => {
  useEffect(() => {
    load().catch(onLoadError);

    const unlisten = listen<SettingsSnapshot>("settings-updated", (event) => {
      applySnapshot(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [load, applySnapshot, onLoadError]);
};
