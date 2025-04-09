import { create } from "zustand";
import { HistoryState } from "./types";
import { produce } from "immer";

export const useHistoryStore = create<HistoryState>((set) => ({
  past: [],
  present: [],
  future: [],

  addAction: (stroke) =>
    set(
      produce((state) => {
        state.past.push(state.present);
        state.present = [...state.present, stroke];
        state.future = [];
      })
    ),

  undo: () =>
    set(
      produce((state) => {
        if (state.past.length > 0) {
          state.future.unshift(state.present);
          state.present = state.past.pop();
        }
      })
    ),

  redo: () =>
    set(
      produce((state) => {
        if (state.future.length > 0) {
          state.past.push(state.present);
          state.present = state.future.shift();
        }
      })
    ),

  clear: () =>
    set(
      produce((state) => {
        state.past.push(state.present);
        state.present = [];
        state.future = [];
      })
    ),

  reset: () => set(() => ({ past: [], present: [], future: [] })),
}));

export const usePast = () => useHistoryStore((state) => state.past);
export const usePresent = () => useHistoryStore((state) => state.present);
export const useFuture = () => useHistoryStore((state) => state.future);
export const useAddRecord = () => useHistoryStore((state) => state.addAction);
export const useUndo = () => useHistoryStore((state) => state.undo);
export const useRedo = () => useHistoryStore((state) => state.redo);
export const useClear = () => useHistoryStore((state) => state.clear);
export const useReset = () => useHistoryStore((state) => state.reset);
