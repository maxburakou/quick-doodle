import { create } from "zustand";
import { SettingsState } from "./types";

export const useSettingsStore = create<SettingsState>((set) => ({
  color: '#000000',
  thickness: 3,
  setColor: (color) => set({ color }),
  setThickness: (thickness) => set({ thickness }),
}));