import { create } from "zustand";
import { ToolSettingsState } from "./types";
import { DEFAULT_STROKE_COLORS, DEFAULT_STROKE_WIDTH } from "@/config";

export const useToolSettingsStore = create<ToolSettingsState>((set, get) => ({
  color: DEFAULT_STROKE_COLORS[0],
  colors: DEFAULT_STROKE_COLORS,
  thickness: DEFAULT_STROKE_WIDTH[1],
  thicknesses: DEFAULT_STROKE_WIDTH,
  setColor: (color) => set({ color }),
  setThickness: (thickness) => set({ thickness }),
  updateColor: (newColor: string) =>
    set(({ colors, color }) => {
      const updatedColors = colors.map((c) => (c === color ? newColor : c));
      return { colors: updatedColors, color: newColor };
    }),

  toNextColor: () => {
    const { color, colors } = get();
    const index = colors.indexOf(color);
    if (index < colors.length - 1) {
      set({ color: colors[index + 1] });
    }
  },

  toPrevColor: () => {
    const { color, colors } = get();
    const index = colors.indexOf(color);
    if (index > 0) {
      set({ color: colors[index - 1] });
    }
  },

  toNextThickness: () => {
    const { thickness, thicknesses } = get();
    const index = thicknesses.indexOf(thickness);
    if (index < thicknesses.length - 1) {
      set({ thickness: thicknesses[index + 1] });
    }
  },

  toPrevThickness: () => {
    const { thickness, thicknesses } = get();
    const index = thicknesses.indexOf(thickness);
    if (index > 0) {
      set({ thickness: thicknesses[index - 1] });
    }
  },
}));

export const useToolColor = () => useToolSettingsStore((state) => state.color);
export const useToolColors = () =>
  useToolSettingsStore((state) => state.colors);
export const useToolThickness = () =>
  useToolSettingsStore((state) => state.thickness);
export const useToolThicknesses = () =>
  useToolSettingsStore((state) => state.thicknesses);
export const useSetToolColor = () =>
  useToolSettingsStore((state) => state.setColor);
export const useSetToolThickness = () =>
  useToolSettingsStore((state) => state.setThickness);
export const useUpdateToolColor = () =>
  useToolSettingsStore((state) => state.updateColor);
export const useToNextToolColor = () =>
  useToolSettingsStore((state) => state.toNextColor);
export const useToPrevToolColor = () =>
  useToolSettingsStore((state) => state.toPrevColor);
export const useToNextToolThickness = () =>
  useToolSettingsStore((state) => state.toNextThickness);
export const useToPrevToolThickness = () =>
  useToolSettingsStore((state) => state.toPrevThickness);
