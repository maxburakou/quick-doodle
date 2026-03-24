import { useCallback } from "react";
import { useSettingsStore } from "@/store";
import { useShortcutRecordingCapture } from "./hooks/useShortcutRecordingCapture";
import { useSettingsSnapshotSync } from "./hooks/useSettingsSnapshotSync";
import { ErrorSection, SettingsContent, SettingsFooter } from "./components";
import { useSettingsPageStore } from "./store";
import { useThemeBootstrap } from "@/hooks/useThemeBootstrap";
import "./styles.css";

const SettingsApp = () => {
  const { load, draft, applySnapshot, snapshot } = useSettingsStore();
  useThemeBootstrap(snapshot?.theme?.mode);

  const setRuntimeErrorFromUnknown = useSettingsPageStore(
    (state) => state.setRuntimeErrorFromUnknown
  );

  const handleLoadError = useCallback((err: unknown) => {
    setRuntimeErrorFromUnknown(err);
  }, [setRuntimeErrorFromUnknown]);

  useSettingsSnapshotSync({
    load,
    applySnapshot,
    onLoadError: handleLoadError,
  });

  useShortcutRecordingCapture();

  return (
    <main className="settings-page">
      <div className="settings-page__content">
        {draft ? (
          <SettingsContent />
        ) : (
          <section className="settings-loading" aria-busy="true" aria-live="polite">
            <p className="settings-loading__text">Loading settings...</p>
          </section>
        )}
      </div>

      <ErrorSection />
      <SettingsFooter />
    </main>
  );
};

export default SettingsApp;
