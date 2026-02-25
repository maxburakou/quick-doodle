import { useEffect } from "react";
import { handleCanvasEvent, handleKeyDownEvent } from "../helpers";
import { useCanvasStore, useHistoryStore, useSnapStore } from "@/store";
import { useToolbarStore } from "@/store/useToolbarStore";

const { undo, redo, clear, reset } = useHistoryStore.getState();
const { toggleBackground: toggleCanvas } = useCanvasStore.getState();
const { toggleVisibility: toggleToolbar } = useToolbarStore.getState();
const { toggleEnabled: toggleSnap } = useSnapStore.getState();

export const useShortcuts = () => {
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("keydown", handleKeyDownEvent);
    window.addEventListener("contextmenu", handleContextMenu);

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
    const unsubscribeToggleSnap = handleCanvasEvent(
      "toggle-snap-canvas",
      toggleSnap
    );

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
    };
  }, []);
};
