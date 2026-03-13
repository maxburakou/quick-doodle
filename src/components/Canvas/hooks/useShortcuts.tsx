import { useEffect } from "react";
import {
  handleCanvasEvent,
  handleKeyDownEvent,
  updateCanvasShortcutMatcher,
} from "../helpers";
import { useCanvasStore, useHistoryStore, useSettingsStore, useSnapStore } from "@/store";
import { useToolbarStore } from "@/store/useToolbarStore";
import { listen } from "@tauri-apps/api/event";
import { SettingsSnapshot } from "@/types/settings";

const { undo, redo, clear, reset } = useHistoryStore.getState();
const { toggleBackground: toggleCanvas } = useCanvasStore.getState();
const { toggleVisibility: toggleToolbar } = useToolbarStore.getState();
const { toggleEnabled: toggleSnap } = useSnapStore.getState();

const initializeShortcutMatcher = async () => {
  const { load, snapshot } = useSettingsStore.getState();
  if (!snapshot) {
    await load();
  }

  const activeSnapshot = useSettingsStore.getState().snapshot;
  if (activeSnapshot) {
    updateCanvasShortcutMatcher(activeSnapshot);
  }
};

const subscribeToSettingsUpdates = () =>
  listen<SettingsSnapshot>("settings-updated", (event) => {
    const payload = event.payload;
    updateCanvasShortcutMatcher(payload);
    useSettingsStore.getState().applySnapshot(payload);
  });

export const useShortcuts = () => {
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("keydown", handleKeyDownEvent);
    window.addEventListener("contextmenu", handleContextMenu);

    initializeShortcutMatcher();

    const unsubscribeSettings = subscribeToSettingsUpdates();

    const unsubscribeUndo = handleCanvasEvent("undo-canvas", undo);
    const unsubscribeReset = handleCanvasEvent("reset-canvas", reset);
    const unsubscribeClear = handleCanvasEvent("clear-canvas", clear);
    const unsubscribeRedo = handleCanvasEvent("redo-canvas", redo);
    const unsubscribeToggleCanvas = handleCanvasEvent(
      "toggle-background-canvas",
      toggleCanvas
    );
    const unsubscribeToggleToolbar = handleCanvasEvent(
      "toggle-toolbar-canvas",
      toggleToolbar
    );
    const unsubscribeToggleSnap = handleCanvasEvent("toggle-snap-canvas", toggleSnap);

    return () => {
      window.removeEventListener("keydown", handleKeyDownEvent);
      window.removeEventListener("contextmenu", handleContextMenu);
      unsubscribeUndo.then((_) => _());
      unsubscribeRedo.then((_) => _());
      unsubscribeClear.then((_) => _());
      unsubscribeReset.then((_) => _());
      unsubscribeToggleCanvas.then((_) => _());
      unsubscribeToggleToolbar.then((_) => _());
      unsubscribeToggleSnap.then((_) => _());
      unsubscribeSettings.then((_) => _());
    };
  }, []);
};
