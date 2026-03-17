import { useEffect, useLayoutEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useThemeStore, ThemeMode } from "@/store/useThemeStore";
import { SettingsSnapshot } from "@/types/settings";

const THEME_MODE_ATTRIBUTE = "data-theme";
const PREFERS_DARK_QUERY = "(prefers-color-scheme: dark)";

const applyThemeModeToDom = (mode: ThemeMode) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.setAttribute(THEME_MODE_ATTRIBUTE, mode);

  if (mode === "system") {
    const hasSystemThemeSupport =
      typeof window !== "undefined" && typeof window.matchMedia === "function";
    root.style.colorScheme = hasSystemThemeSupport ? "light dark" : "light";
    return;
  }

  root.style.colorScheme = mode;
};

const useThemeDomSync = () => {
  const mode = useThemeStore((state) => state.mode);
  const isSystem = useThemeStore((state) => state.isSystem);
  const setSystemPrefersDark = useThemeStore((state) => state.setSystemPrefersDark);

  useEffect(() => {
    if (!isSystem) return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setSystemPrefersDark(false);
      return;
    }

    const mediaQuery = window.matchMedia(PREFERS_DARK_QUERY);
    const applyCurrent = () => setSystemPrefersDark(mediaQuery.matches);
    applyCurrent();

    mediaQuery.addEventListener("change", applyCurrent);
    return () => {
      mediaQuery.removeEventListener("change", applyCurrent);
    };
  }, [isSystem, setSystemPrefersDark]);

  useLayoutEffect(() => {
    applyThemeModeToDom(mode);
  }, [mode]);
};

export const useThemeBootstrap = (snapshotMode?: ThemeMode) => {
  const setMode = useThemeStore((state) => state.setMode);

  useEffect(() => {
    if (snapshotMode) {
      setMode(snapshotMode);
      return;
    }

    invoke<SettingsSnapshot>("settings_get_snapshot")
      .then((snapshot) => setMode(snapshot.theme?.mode ?? "system"))
      .catch(() => undefined);

    const unlistenPromise = listen<SettingsSnapshot>("settings-updated", (event) => {
      setMode(event.payload.theme?.mode ?? "system");
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [setMode, snapshotMode]);

  useThemeDomSync();
};
