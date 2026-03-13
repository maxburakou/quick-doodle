import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

const MAIN_WINDOW_VISIBILITY_CHANGED_EVENT = "main-window-visibility-changed";
const IS_TAURI_RUNTIME =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type MainWindowVisibilityState = {
  isVisible: boolean;
  isTauriRuntime: boolean;
};

export const useMainWindowVisibility = (): MainWindowVisibilityState => {
  const [isVisible, setIsVisible] = useState(!IS_TAURI_RUNTIME);

  useEffect(() => {
    if (!IS_TAURI_RUNTIME) return;

    const unsubscribePromise = listen<boolean>(
      MAIN_WINDOW_VISIBILITY_CHANGED_EVENT,
      (event) => {
        setIsVisible(event.payload);
      }
    );

    return () => {
      unsubscribePromise.then((unsubscribe) => unsubscribe());
    };
  }, []);

  return { isVisible, isTauriRuntime: IS_TAURI_RUNTIME };
};
