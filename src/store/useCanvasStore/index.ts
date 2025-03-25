import { create } from "zustand";
import { CanvasState } from "./types";
import { CanvasBackground } from "@/types";

export const useCanvasStore = create<CanvasState>((set) => ({
  background: CanvasBackground.Transparent,
  setBackground: (background) => set({ background }),
  toggleBackground: () =>
    set((state) => ({
      background:
        state.background === CanvasBackground.Transparent
          ? CanvasBackground.Light
          : CanvasBackground.Transparent,
    })),
}));
