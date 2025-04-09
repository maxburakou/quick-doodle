import { create } from "zustand";
import { TextSettingsActions, TextSettingsState } from "./types";
import { DEFAULT_FONT_SIZE } from "@/config";

const initialState: TextSettingsState = {
  fontSize: DEFAULT_FONT_SIZE[0],
  fontSizes: DEFAULT_FONT_SIZE,
};

export const useTextSettingsStore = create<
  TextSettingsState & TextSettingsActions
>((set, get) => ({
  ...initialState,
  setFontSize: (fontSize) => set({ fontSize }),
  updateFontSize: (newFontSize: number) =>
    set(({ fontSizes, fontSize }) => {
      if (newFontSize === fontSize || fontSizes.includes(newFontSize))
        return {};

      const updatedFontSizes = fontSizes.map((f) =>
        f === fontSize ? newFontSize : f
      );
      return { fontSizes: updatedFontSizes, fontSize: newFontSize };
    }),
  toNextFontSize: () => {
    const { fontSize, fontSizes } = get();
    const index = fontSizes.indexOf(fontSize);
    if (index < fontSizes.length - 1) {
      set({ fontSize: fontSizes[index + 1] });
    }
  },
  toPrevFontSize: () => {
    const { fontSize, fontSizes } = get();

    const index = fontSizes.indexOf(fontSize);
    if (index > 0) {
      set({ fontSize: fontSizes[index - 1] });
    }
  },
}));

export const useFontSize = () =>
  useTextSettingsStore((state) => state.fontSize);
export const useFontSizes = () =>
  useTextSettingsStore((state) => state.fontSizes);
export const useSetFontSize = () =>
  useTextSettingsStore((state) => state.setFontSize);
export const useUpdateFontSize = () =>
  useTextSettingsStore((state) => state.updateFontSize);
export const useToNextFontSize = () =>
  useTextSettingsStore((state) => state.toNextFontSize);
export const useToPrevFontSize = () =>
  useTextSettingsStore((state) => state.toPrevFontSize);
