import { EffectiveTheme } from "@/store/useThemeStore";

export const PRIMARY_COLORS_BY_THEME: Record<EffectiveTheme, string> = {
  light: "#006fe6",
  dark: "#0a84ff",
};

export const MARQUEE_FILL_ALPHA = 0.06;

export const SNAP_GUIDE_WIDTH = 1.5;
export const SNAP_GUIDE_DASH: Readonly<[number, number]> = [0, 6];

export const SELECTION_OUTLINE_WIDTH = 1;
export const SELECTION_OUTLINE_WIDTH_HOVER = 1.75;
export const SELECTION_MIN_FILL_SIZE = 4;
export const SELECTION_FILL_ALPHA = MARQUEE_FILL_ALPHA;
export const SELECTION_FILL_ALPHA_GROUP = MARQUEE_FILL_ALPHA;

export const SELECTION_HANDLE_FILL_BY_THEME: Record<EffectiveTheme, string> = {
  light: "#ffffff",
  dark: "#f5f5f7",
};
