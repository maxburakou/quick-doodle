import { create } from "zustand";
import { ToolbarState } from "./types";

export const useToolbarStore = create<ToolbarState>((set) => ({
  visibility: true,
  setVisibility: (visibility) => set({ visibility }),
  toggleVisibility: () => set((state) => ({ visibility: !state.visibility })),
}));

export const useToolbarVisibility = () =>
  useToolbarStore((state) => state.visibility);
export const useToggleToolbarVisibility = () =>
  useToolbarStore((state) => state.toggleVisibility);
