import { create } from "zustand";
import { useSettingsStore } from "@/store";
import { ShortcutScopeKey } from "../types";
import {
  cancelChanges,
  captureRecordedShortcut,
  closeSettingsWindow,
  revalidateShortcuts,
  resetShortcut as resetShortcutSetting,
  revertSettingsDefaults,
  saveSettings,
  toggleRecording,
} from "../services/settingsService";

interface SettingsPageStoreState {
  runtimeError: string | null;
  saving: boolean;
  recordingRowKey: string | null;
  setRecordingRowKey: (
    value: string | null | ((current: string | null) => string | null)
  ) => void;
  setRuntimeError: (value: string | null) => void;
  setRuntimeErrorFromUnknown: (error: unknown) => void;
  clearRuntimeError: () => void;
  startRecording: (scope: ShortcutScopeKey, actionId: string) => void;
  resetShortcut: (scope: ShortcutScopeKey, actionId: string) => void;
  captureRecording: (event: KeyboardEvent) => void;
  saveAndClose: () => Promise<void>;
  revertDefaults: () => Promise<void>;
  cancelChanges: () => void;
}

export const useSettingsPageStore = create<SettingsPageStoreState>((set, get) => ({
  runtimeError: null,
  saving: false,
  recordingRowKey: null,

  setRecordingRowKey: (value) => {
    set((state) => ({
      recordingRowKey: typeof value === "function" ? value(state.recordingRowKey) : value,
    }));
  },

  setRuntimeError: (value) => {
    set({ runtimeError: value });
  },

  setRuntimeErrorFromUnknown: (error) => {
    set({ runtimeError: String(error) });
  },

  clearRuntimeError: () => {
    set({ runtimeError: null });
  },

  startRecording: (scope, actionId) => {
    toggleRecording({
      scope,
      actionId,
      setRecordingRowKey: get().setRecordingRowKey,
    });
  },

  resetShortcut: (scope, actionId) => {
    const settingsState = useSettingsStore.getState();
    const setRecordingRowKey = get().setRecordingRowKey;

    try {
      resetShortcutSetting({
        scope,
        actionId,
        setDraft: settingsState.setDraft,
        setRecordingRowKey,
        onRevalidate: () => {
          void revalidateShortcuts(settingsState.validate, get().setRuntimeError);
        },
      });
    } catch (error) {
      set({ runtimeError: String(error) });
    }
  },

  captureRecording: (event) => {
    const settingsState = useSettingsStore.getState();
    const recordingRowKey = get().recordingRowKey;

    captureRecordedShortcut({
      event,
      recordingRowKey,
      setRecordingRowKey: get().setRecordingRowKey,
      setDraft: settingsState.setDraft,
      onRevalidate: () => {
        void revalidateShortcuts(settingsState.validate, get().setRuntimeError);
      },
    });
  },

  saveAndClose: async () => {
    const settingsState = useSettingsStore.getState();
    const setRecordingRowKey = get().setRecordingRowKey;

    set({ runtimeError: null });

    const result = await saveSettings({
      validate: settingsState.validate,
      save: settingsState.save,
      setSaving: (value) => {
        set({ saving: value });
      },
      setRecordingRowKey,
    });

    if (!result.ok) {
      if (result.runtimeError) {
        set({ runtimeError: result.runtimeError });
      }
      return;
    }

    set({ runtimeError: null });
    await closeSettingsWindow((value) => {
      set({ runtimeError: value });
    });
  },

  revertDefaults: async () => {
    const settingsState = useSettingsStore.getState();
    const setRecordingRowKey = get().setRecordingRowKey;

    set({ runtimeError: null });

    await revertSettingsDefaults({
      revertDefaults: settingsState.revertDefaults,
      setRecordingRowKey,
      setRuntimeError: (value) => {
        set({ runtimeError: value });
      },
    });
  },

  cancelChanges: () => {
    const settingsState = useSettingsStore.getState();
    const setRecordingRowKey = get().setRecordingRowKey;

    set({ runtimeError: null });

    cancelChanges({
      cancel: settingsState.cancel,
      setRecordingRowKey,
    });
  },
}));
