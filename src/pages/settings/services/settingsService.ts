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

type SetRuntimeError = (value: string | null) => void;
type SetSaving = (value: boolean) => void;
type SetRecordingRowKey = (
  value: string | null | ((current: string | null) => string | null)
) => void;
type SetDraft = (updater: (draft: SettingsSnapshot) => SettingsSnapshot) => void;

type Validate = () => Promise<ValidationIssue[]>;
type Save = () => Promise<void>;
type RevertDefaults = () => Promise<void>;
type Cancel = () => void;

export interface SaveSettingsResult {
  ok: boolean;
  validationCount?: number;
  runtimeError?: string;
}

export const revalidateShortcuts = async (validate: Validate, setRuntimeError: SetRuntimeError) => {
  try {
    await validate();
  } catch (err) {
    setRuntimeError(String(err));
  }
};

export const saveSettings = async ({
  validate,
  save,
  setSaving,
  setRecordingRowKey,
}: {
  validate: Validate;
  save: Save;
  setSaving: SetSaving;
  setRecordingRowKey: SetRecordingRowKey;
}): Promise<SaveSettingsResult> => {
  setSaving(true);

  try {
    const issues = await validate();
    if (issues.length > 0) {
      return {
        ok: false,
        validationCount: issues.length,
      };
    }

    await save();
    setRecordingRowKey(null);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      runtimeError: String(err),
    };
  } finally {
    setSaving(false);
  }
};

export const closeSettingsWindow = async (setRuntimeError: SetRuntimeError) => {
  try {
    await invoke("settings_hide_window");
  } catch (err) {
    setRuntimeError(String(err));
  }
};

export const revertSettingsDefaults = async ({
  revertDefaults,
  setRecordingRowKey,
  setRuntimeError,
}: {
  revertDefaults: RevertDefaults;
  setRecordingRowKey: SetRecordingRowKey;
  setRuntimeError: SetRuntimeError;
}) => {
  setRecordingRowKey(null);

  try {
    await revertDefaults();
  } catch (err) {
    setRuntimeError(String(err));
  }
};

export const cancelChanges = ({
  cancel,
  setRecordingRowKey,
}: {
  cancel: Cancel;
  setRecordingRowKey: SetRecordingRowKey;
}) => {
  setRecordingRowKey(null);
  cancel();
};

export const toggleRecording = ({
  scope,
  actionId,
  setRecordingRowKey,
}: {
  scope: ShortcutScopeKey;
  actionId: string;
  setRecordingRowKey: SetRecordingRowKey;
}) => {
  const rowKey = buildRowKey(scope, actionId);
  setRecordingRowKey((current) => (current === rowKey ? null : rowKey));
};

export const resetShortcut = ({
  scope,
  actionId,
  setDraft,
  setRecordingRowKey,
  onRevalidate,
}: {
  scope: ShortcutScopeKey;
  actionId: string;
  setDraft: SetDraft;
  setRecordingRowKey: SetRecordingRowKey;
  onRevalidate: () => void;
}) => {
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
