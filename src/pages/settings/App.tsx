import { useCallback, useEffect, useMemo, useState } from "react";
import { useSettingsStore } from "@/store";
import { mapShortcutSections } from "./helpers/shortcuts";
import { useSettingsSnapshotSync } from "./hooks/useSettingsSnapshotSync";
import { ErrorSection, SettingsContent, SettingsFooter } from "./components";
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

  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recordingRowKey, setRecordingRowKey] = useState<string | null>(null);

  const handleLoadError = useCallback((err: unknown) => {
    setRuntimeError(String(err));
  }, []);

  useSettingsSnapshotSync({
    load,
    applySnapshot,
    onLoadError: handleLoadError,
  });

  const runRevalidateShortcuts = useCallback(() => {
    void revalidateShortcuts(validate, setRuntimeError);
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
    setRuntimeError(null);

    const result = await saveSettings({
      validate,
      save,
      setSaving,
      setRecordingRowKey,
    });

    if (!result.ok) {
      if (result.runtimeError) {
        setRuntimeError(result.runtimeError);
      }

      return;
    }

    setRuntimeError(null);
    await closeSettingsWindow(setRuntimeError);
  };

  const handleRevertDefaults = async () => {
    setRuntimeError(null);

    await revertSettingsDefaults({
      revertDefaults,
      setRecordingRowKey,
      setRuntimeError,
    });
  };

  const handleCancel = () => {
    setRuntimeError(null);

    cancelChanges({
      cancel,
      setRecordingRowKey,
    });
  };

  const handleRecordStart = (scope: ShortcutScopeKey, actionId: string) => {
    toggleRecording({
      scope,
      actionId,
      setRecordingRowKey,
    });
  };

  const handleReset = (scope: ShortcutScopeKey, actionId: string) => {
    resetShortcut({
      scope,
      actionId,
      setDraft,
      setRecordingRowKey,
      onRevalidate: runRevalidateShortcuts,
    });
  };

  const handleAutostartChange = (enabled: boolean) => {
    setDraft((nextDraft) => ({
      ...nextDraft,
      autostart: {
        ...nextDraft.autostart,
        enabled,
      },
    }));
  };

  const validationSummary =
    validationIssues.length > 0 ? `${validationIssues.length} validation issue(s).` : null;
  const errorStripMessage = validationSummary ?? runtimeError;

  return (
    <main className="settings-page">
      <div className="settings-page__content">
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

      {errorStripMessage ? <ErrorSection message={errorStripMessage} /> : null}

      <SettingsFooter
        dirty={dirty}
        saving={saving}
        saveDisabled={validationIssues.length > 0}
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
