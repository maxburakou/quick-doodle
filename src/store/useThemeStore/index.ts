import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";
export type EffectiveTheme = "light" | "dark";

interface ThemeStoreState {
  mode: ThemeMode;
  isSystem: boolean;
  effectiveTheme: EffectiveTheme;
  systemPrefersDark: boolean;
  setMode: (mode: ThemeMode) => void;
  setSystemPrefersDark: (prefersDark: boolean) => void;
}

const resolveEffectiveTheme = (
  mode: ThemeMode,
  systemPrefersDark: boolean
): EffectiveTheme => {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
};

const deriveThemeState = (mode: ThemeMode, systemPrefersDark: boolean) => ({
  mode,
  isSystem: mode === "system",
  effectiveTheme: resolveEffectiveTheme(mode, systemPrefersDark),
});

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  ...deriveThemeState("system", false),
  systemPrefersDark: false,

  setMode: (mode) => {
    const { mode: currentMode, systemPrefersDark } = get();
    if (currentMode === mode) return;

    set({
      ...deriveThemeState(mode, systemPrefersDark),
      systemPrefersDark,
    });
  },

  setSystemPrefersDark: (systemPrefersDark) => {
    const { mode, systemPrefersDark: currentSystemPrefersDark } = get();
    if (currentSystemPrefersDark === systemPrefersDark) return;

    set({
      ...deriveThemeState(mode, systemPrefersDark),
      systemPrefersDark,
    });
  },
}));
