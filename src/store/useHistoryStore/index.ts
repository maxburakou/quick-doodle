import { create } from "zustand";
import { HistoryState } from "./types";

export const MAX_UNDO_DEPTH = 50;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  present: [],
  future: [],

  commitPresent: (nextPresent) =>
    set((state) => ({
      past: [...state.past, state.present].slice(-MAX_UNDO_DEPTH),
      present: nextPresent,
      future: [],
    })),

  addAction: (stroke) => {
    const { present, commitPresent } = get();
    commitPresent([...present, stroke]);
  },

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return state;

      const nextPast = state.past.slice(0, -1);
      const nextPresent = state.past[state.past.length - 1];

      return {
        past: nextPast,
        present: nextPresent,
        future: [state.present, ...state.future],
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return state;

      const nextPresent = state.future[0];
      const nextFuture = state.future.slice(1);

      return {
        past: [...state.past, state.present].slice(-MAX_UNDO_DEPTH),
        present: nextPresent,
        future: nextFuture,
      };
    }),

  clear: () => {
    const { commitPresent } = get();
    commitPresent([]);
  },

  reset: () => set(() => ({ past: [], present: [], future: [] })),
}));

export const usePast = () => useHistoryStore((state) => state.past);
export const usePresent = () => useHistoryStore((state) => state.present);
export const useFuture = () => useHistoryStore((state) => state.future);
export const useCommitPresent = () =>
  useHistoryStore((state) => state.commitPresent);
export const useAddRecord = () => useHistoryStore((state) => state.addAction);
export const useUndo = () => useHistoryStore((state) => state.undo);
export const useRedo = () => useHistoryStore((state) => state.redo);
export const useClear = () => useHistoryStore((state) => state.clear);
export const useReset = () => useHistoryStore((state) => state.reset);
