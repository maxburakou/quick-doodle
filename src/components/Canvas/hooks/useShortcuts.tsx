import { useEffect } from "react";
import { handleCanvasEvent, handleKeyDownEvent } from "../helpers";
import { useCanvasStore, useHistoryStore } from "@/store";
import { useToolbarStore } from "@/store/useToolbarStore";

const { undo, redo, clear, reset } = useHistoryStore.getState();
const { toggleBackground: toggleCanvas } = useCanvasStore.getState();
const { toggleVisibility: toggleToolbar } = useToolbarStore.getState();

export const useShortcuts = () => {
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDownEvent);
    window.addEventListener("contextmenu", (event) => event.preventDefault());

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

    return () => {
      window.removeEventListener("keydown", handleKeyDownEvent);
      window.removeEventListener("contextmenu", (event) =>
        event.preventDefault()
      );
      unsubscribeUndo.then((_) => _());
      unsubscribeRedo.then((_) => _());
      unsubscribeClear.then((_) => _());
      unsubscribeReset.then((_) => _());
      unsubscribeToggleCanvas.then((_) => _());
      unsubscribeToggleToolbar.then((_) => _());
    };
  }, []);
};
