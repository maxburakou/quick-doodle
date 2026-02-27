import { useCallback, useEffect, useMemo, useState } from "react";
import { useSettingsStore } from "@/store";
import {
  buildRowKey,
  isModifierOnlyKey,
  keyboardEventToBinding,
  mapShortcutSections,
  parseRowKey,
  updateActionPrimaryBinding,
} from "./helpers/shortcuts";
import { useSettingsSnapshotSync } from "./hooks/useSettingsSnapshotSync";
import { SettingsContent, SettingsFooter } from "./components";
import { ShortcutScopeKey } from "./types";
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

  useEffect(() => {
    if (!recordingRowKey) return;

    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.code === "Escape") {
        setRecordingRowKey(null);
        return;
      }

      if (isModifierOnlyKey(event.code)) {
        return;
      }

      const row = parseRowKey(recordingRowKey);
      if (!row) {
        setRecordingRowKey(null);
        return;
      }

      setDraft((nextDraft) =>
        updateActionPrimaryBinding(
          nextDraft,
          row.scope,
          row.actionId,
          keyboardEventToBinding(event)
        )
      );
      setRecordingRowKey(null);
    };

    window.addEventListener("keydown", handler, { capture: true });

    return () => {
      window.removeEventListener("keydown", handler, { capture: true });
    };
  }, [recordingRowKey, setDraft]);

  const sections = useMemo(() => {
    if (!draft) return [];
    return mapShortcutSections(draft, validationIssues);
  }, [draft, validationIssues]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      const issues = await validate();
      if (issues.length > 0) {
        setError(`${issues.length} validation issue(s).`);
        return;
      }

      await save();
      setRecordingRowKey(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRevertDefaults = async () => {
    setError(null);
    setRecordingRowKey(null);

    try {
      await revertDefaults();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleCancel = () => {
    setError(null);
    setRecordingRowKey(null);
    cancel();
  };

  const handleRecordStart = (scope: ShortcutScopeKey, actionId: string) => {
    setError(null);

    const rowKey = buildRowKey(scope, actionId);
    setRecordingRowKey((current) => (current === rowKey ? null : rowKey));
  };

  const handleReset = (scope: ShortcutScopeKey, actionId: string) => {
    setError(null);
    setDraft((nextDraft) => updateActionPrimaryBinding(nextDraft, scope, actionId, null));

    const rowKey = buildRowKey(scope, actionId);
    setRecordingRowKey((current) => (current === rowKey ? null : current));
  };

  return (
    <main className="settings-page">
      <div className="settings-page__content">
        {error ? <p className="settings-page__error">{error}</p> : null}

        {draft ? (
          <SettingsContent
            sections={sections}
            recordingRowKey={recordingRowKey}
            onRecordStart={handleRecordStart}
            onReset={handleReset}
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
