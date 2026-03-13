import { create } from "zustand";
import { SnapState } from "./types";

export const useSnapStore = create<SnapState>((set) => ({
  enabled: true,
  setEnabled: (enabled) => set({ enabled }),
  toggleEnabled: () => set((state) => ({ enabled: !state.enabled })),
}));

export const useSnapEnabled = () => useSnapStore((state) => state.enabled);
export const useToggleSnapEnabled = () =>
  useSnapStore((state) => state.toggleEnabled);
