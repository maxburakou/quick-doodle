import { invoke } from "@tauri-apps/api/core";
import { ThemeMode, useThemeStore } from "@/store/useThemeStore";

const nextThemeMode = (mode: ThemeMode): ThemeMode => {
  if (mode === "light") return "dark";
  if (mode === "dark") return "system";
  return "light";
};

export const toggleThemeMode = () => {
  const currentMode = useThemeStore.getState().mode;
  const mode = nextThemeMode(currentMode);
  void invoke("settings_set_theme_mode", { mode }).catch((error) => {
    console.error("Failed to toggle theme mode", { mode, error });
  });
};
