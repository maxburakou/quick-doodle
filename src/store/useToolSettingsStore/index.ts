import { create } from "zustand";
import { SettingsState } from "./types";
import { DEFAULT_STROKE_COLORS, DEFAULT_STROKE_WIDTH } from "@/config";

export const useToolSettingsStore = create<SettingsState>((set) => ({
  color: DEFAULT_STROKE_COLORS[0],
  colors: DEFAULT_STROKE_COLORS,
  thickness: DEFAULT_STROKE_WIDTH[0],
  setColor: (color) => set({ color }),
  setThickness: (thickness) => set({ thickness }),
  updateColor: (newColor: string) =>
    set(({ colors, color }) => {
      const updatedColors = colors.map((c) => (c === color ? newColor : c));
      return { colors: updatedColors, color: newColor };
    }),
}));
