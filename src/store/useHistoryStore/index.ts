import { create } from "zustand";
import { Stroke } from "@/types";
import { HistoryState } from "./types";

export const MAX_UNDO_DEPTH = 50;

export const replaceStrokesInPresent = (
  present: Stroke[],
  sourceIds: string[],
  replacementStrokes: Stroke[]
): Stroke[] | null => {
  if (sourceIds.length === 0 || replacementStrokes.length === 0) return null;

  const sourceIdSet = new Set(sourceIds);
  const firstSourceIndex = present.findIndex((stroke) => sourceIdSet.has(stroke.id));
  if (firstSourceIndex < 0) return null;

  for (const sourceId of sourceIdSet) {
    if (!present.some((stroke) => stroke.id === sourceId)) return null;
  }

  const insertIndex = present
    .slice(0, firstSourceIndex)
    .filter((stroke) => !sourceIdSet.has(stroke.id)).length;
  const filteredPresent = present.filter((stroke) => !sourceIdSet.has(stroke.id));

  return [
    ...filteredPresent.slice(0, insertIndex),
    ...replacementStrokes,
    ...filteredPresent.slice(insertIndex),
  ];
};

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

  replaceStrokesWithAction: (sourceIds, replacementStrokes) => {
    const { present, commitPresent } = get();
    const nextPresent = replaceStrokesInPresent(
      present,
      sourceIds,
      replacementStrokes
    );
    if (!nextPresent) return false;

    commitPresent(nextPresent);
    return true;
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
