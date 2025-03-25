import { create } from "zustand";
import { ToolbarState } from "./types";

export const useToolbarStore = create<ToolbarState>((set) => ({
  isVisible: true,
  setIsVisible: (isVisible) => set({ isVisible }),
  toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),
}));
