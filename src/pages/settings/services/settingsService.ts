import { SettingsSnapshot, ValidationIssue } from "@/types/settings";
import { invoke } from "@tauri-apps/api/core";
import {
  buildRowKey,
  isModifierOnlyKey,
  keyboardEventToBinding,
  parseRowKey,
  updateActionPrimaryBinding,
} from "../helpers/shortcuts";
import { ShortcutScopeKey } from "../types";

type SetError = (value: string | null) => void;
type SetSaving = (value: boolean) => void;
type SetRecordingRowKey = (value: string | null | ((current: string | null) => string | null)) => void;
type SetDraft = (updater: (draft: SettingsSnapshot) => SettingsSnapshot) => void;

type Validate = () => Promise<ValidationIssue[]>;
type Save = () => Promise<void>;
type RevertDefaults = () => Promise<void>;
type Cancel = () => void;

export const revalidateShortcuts = async (validate: Validate, setError: SetError) => {
  try {
    await validate();
  } catch (err) {
    setError(String(err));
  }
};

export const saveSettings = async ({
  validate,
  save,
  setError,
  setSaving,
  setRecordingRowKey,
}: {
  validate: Validate;
  save: Save;
  setError: SetError;
  setSaving: SetSaving;
  setRecordingRowKey: SetRecordingRowKey;
}) => {
  setError(null);
  setSaving(true);

  try {
    const issues = await validate();
    if (issues.length > 0) {
      setError(`${issues.length} validation issue(s).`);
      return false;
    }

    await save();
    setRecordingRowKey(null);
    return true;
  } catch (err) {
    setError(String(err));
    return false;
  } finally {
    setSaving(false);
  }
};

export const closeSettingsWindow = async (setError: SetError) => {
  try {
    await invoke("settings_hide_window");
  } catch (err) {
    setError(String(err));
  }
};

export const revertSettingsDefaults = async ({
  revertDefaults,
  setError,
  setRecordingRowKey,
}: {
  revertDefaults: RevertDefaults;
  setError: SetError;
  setRecordingRowKey: SetRecordingRowKey;
}) => {
  setError(null);
  setRecordingRowKey(null);

  try {
    await revertDefaults();
  } catch (err) {
    setError(String(err));
  }
};

export const cancelChanges = ({
  cancel,
  setError,
  setRecordingRowKey,
}: {
  cancel: Cancel;
  setError: SetError;
  setRecordingRowKey: SetRecordingRowKey;
}) => {
  setError(null);
  setRecordingRowKey(null);
  cancel();
};

export const toggleRecording = ({
  scope,
  actionId,
  setError,
  setRecordingRowKey,
}: {
  scope: ShortcutScopeKey;
  actionId: string;
  setError: SetError;
  setRecordingRowKey: SetRecordingRowKey;
}) => {
  setError(null);

  const rowKey = buildRowKey(scope, actionId);
  setRecordingRowKey((current) => (current === rowKey ? null : rowKey));
};

export const resetShortcut = ({
  scope,
  actionId,
  setError,
  setDraft,
  setRecordingRowKey,
  onRevalidate,
}: {
  scope: ShortcutScopeKey;
  actionId: string;
  setError: SetError;
  setDraft: SetDraft;
  setRecordingRowKey: SetRecordingRowKey;
  onRevalidate: () => void;
}) => {
  setError(null);
  setDraft((nextDraft) => updateActionPrimaryBinding(nextDraft, scope, actionId, null));
  onRevalidate();

  const rowKey = buildRowKey(scope, actionId);
  setRecordingRowKey((current) => (current === rowKey ? null : current));
};

export const captureRecordedShortcut = ({
  event,
  recordingRowKey,
  setRecordingRowKey,
  setDraft,
  onRevalidate,
}: {
  event: KeyboardEvent;
  recordingRowKey: string | null;
  setRecordingRowKey: SetRecordingRowKey;
  setDraft: SetDraft;
  onRevalidate: () => void;
}) => {
  if (!recordingRowKey) return;

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
    updateActionPrimaryBinding(nextDraft, row.scope, row.actionId, keyboardEventToBinding(event))
  );
  setRecordingRowKey(null);
  onRevalidate();
};
