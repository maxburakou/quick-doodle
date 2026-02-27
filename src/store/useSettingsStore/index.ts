import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { SettingsSnapshot, ValidationIssue } from "@/types/settings";

interface SettingsStoreState {
  snapshot: SettingsSnapshot | null;
  draft: SettingsSnapshot | null;
  dirty: boolean;
  validationIssues: ValidationIssue[];
  load: () => Promise<void>;
  setDraft: (updater: (draft: SettingsSnapshot) => SettingsSnapshot) => void;
  cancel: () => void;
  revertDefaults: () => Promise<void>;
  save: () => Promise<void>;
  validate: () => Promise<ValidationIssue[]>;
  applySnapshot: (snapshot: SettingsSnapshot) => void;
}

const cloneSnapshot = (snapshot: SettingsSnapshot): SettingsSnapshot =>
  JSON.parse(JSON.stringify(snapshot));

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  snapshot: null,
  draft: null,
  dirty: false,
  validationIssues: [],

  load: async () => {
    const snapshot = await invoke<SettingsSnapshot>("settings_get_snapshot");
    set({
      snapshot,
      draft: cloneSnapshot(snapshot),
      dirty: false,
      validationIssues: [],
    });
  },

  setDraft: (updater) => {
    const draft = get().draft;
    if (!draft) return;

    const nextDraft = updater(cloneSnapshot(draft));
    set({ draft: nextDraft, dirty: true });
  },

  cancel: () => {
    const snapshot = get().snapshot;
    if (!snapshot) return;

    set({
      draft: cloneSnapshot(snapshot),
      dirty: false,
      validationIssues: [],
    });
  },

  revertDefaults: async () => {
    const defaults = await invoke<SettingsSnapshot>("settings_restore_defaults");
    set({ draft: cloneSnapshot(defaults), dirty: true, validationIssues: [] });
  },

  save: async () => {
    const draft = get().draft;
    if (!draft) return;

    const saved = await invoke<SettingsSnapshot>("settings_save", { snapshot: draft });
    set({
      snapshot: saved,
      draft: cloneSnapshot(saved),
      dirty: false,
      validationIssues: [],
    });
  },

  validate: async () => {
    const draft = get().draft;
    if (!draft) return [];

    const issues = await invoke<ValidationIssue[]>("settings_validate_shortcuts", {
      snapshot: draft,
    });
    set({ validationIssues: issues });
    return issues;
  },

  applySnapshot: (snapshot) => {
    set((state) => ({
      snapshot,
      draft: state.dirty ? state.draft : cloneSnapshot(snapshot),
      dirty: state.dirty,
    }));
  },
}));
