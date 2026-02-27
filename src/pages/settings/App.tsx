import { useCallback, useEffect, useMemo, useState } from "react";
import { useSettingsStore } from "@/store";
import { mapShortcutSections } from "./helpers/shortcuts";
import { useSettingsSnapshotSync } from "./hooks/useSettingsSnapshotSync";
import { SettingsContent, SettingsFooter } from "./components";
import { ShortcutScopeKey } from "./types";
import {
  cancelChanges,
  closeSettingsWindow,
  captureRecordedShortcut,
  resetShortcut,
  revalidateShortcuts,
  revertSettingsDefaults,
  saveSettings,
  toggleRecording,
} from "./services/settingsService";
import "./styles.css";

const SettingsApp = () => {
  const {
    load,
    draft,
    dirty,
    validationIssues,
    save,
    cancel,
    setDraft,
    revertDefaults,
    validate,
    applySnapshot,
  } = useSettingsStore();

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recordingRowKey, setRecordingRowKey] = useState<string | null>(null);

  const handleLoadError = useCallback((err: unknown) => {
    setError(String(err));
  }, []);

  useSettingsSnapshotSync({
    load,
    applySnapshot,
    onLoadError: handleLoadError,
  });

  const runRevalidateShortcuts = useCallback(() => {
    void revalidateShortcuts(validate, setError);
  }, [validate]);

  useEffect(() => {
    if (!recordingRowKey) return;

    const handler = (event: KeyboardEvent) => {
      captureRecordedShortcut({
        event,
        recordingRowKey,
        setRecordingRowKey,
        setDraft,
        onRevalidate: runRevalidateShortcuts,
      });
    };

    window.addEventListener("keydown", handler, { capture: true });

    return () => {
      window.removeEventListener("keydown", handler, { capture: true });
    };
  }, [recordingRowKey, runRevalidateShortcuts, setDraft]);

  const sections = useMemo(() => {
    if (!draft) return [];
    return mapShortcutSections(draft, validationIssues);
  }, [draft, validationIssues]);

  const handleSave = async () => {
    const saved = await saveSettings({
      validate,
      save,
      setError,
      setSaving,
      setRecordingRowKey,
    });

    if (saved) {
      await closeSettingsWindow(setError);
    }
  };

  const handleRevertDefaults = async () => {
    await revertSettingsDefaults({
      revertDefaults,
      setError,
      setRecordingRowKey,
    });
  };

  const handleCancel = () => {
    cancelChanges({
      cancel,
      setError,
      setRecordingRowKey,
    });
  };

  const handleRecordStart = (scope: ShortcutScopeKey, actionId: string) => {
    toggleRecording({
      scope,
      actionId,
      setError,
      setRecordingRowKey,
    });
  };

  const handleReset = (scope: ShortcutScopeKey, actionId: string) => {
    resetShortcut({
      scope,
      actionId,
      setError,
      setDraft,
      setRecordingRowKey,
      onRevalidate: runRevalidateShortcuts,
    });
  };

  const handleAutostartChange = (enabled: boolean) => {
    setError(null);
    setDraft((nextDraft) => ({
      ...nextDraft,
      autostart: {
        ...nextDraft.autostart,
        enabled,
      },
    }));
  };

  return (
    <main className="settings-page">
      <div className="settings-page__content">
        {error ? <p className="settings-page__error">{error}</p> : null}

        {draft ? (
          <SettingsContent
            sections={sections}
            autostartEnabled={draft.autostart.enabled}
            recordingRowKey={recordingRowKey}
            onRecordStart={handleRecordStart}
            onReset={handleReset}
            onAutostartChange={handleAutostartChange}
          />
        ) : (
          <p>Loading settings...</p>
        )}
      </div>

      <SettingsFooter
        dirty={dirty}
        saving={saving}
        onRevertDefaults={() => {
          void handleRevertDefaults();
        }}
        onCancel={handleCancel}
        onSave={() => {
          void handleSave();
        }}
      />
    </main>
  );
};

export default SettingsApp;
