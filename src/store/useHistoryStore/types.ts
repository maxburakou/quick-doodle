import { Stroke } from "@/types";

export interface HistoryState {
  past: Stroke[][];
  present: Stroke[];
  future: Stroke[][];
  commitPresent: (nextPresent: Stroke[]) => void;
  addAction: (stroke: Stroke) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  reset: () => void;
}
