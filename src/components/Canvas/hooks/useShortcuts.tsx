import { useEffect } from "react";
import { handleCanvasEvent, handleKeyDownEvent } from "../helpers";
import { useHistoryStore } from "../../../store";

const { undo, redo, clear, reset } = useHistoryStore.getState();

export const useShortcuts = () => {
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDownEvent);
    window.addEventListener("contextmenu", (event) => event.preventDefault());

    const unsubscribeUndo = handleCanvasEvent("undo-canvas", undo);
    const unsubscribeReset = handleCanvasEvent("reset-canvas", reset);
    const unsubscribeClear = handleCanvasEvent("clear-canvas", clear);
    const unsubscribeRedo = handleCanvasEvent("redo-canvas", redo);

    return () => {
      window.removeEventListener("keydown", handleKeyDownEvent);
      window.removeEventListener("contextmenu", (event) =>
        event.preventDefault()
      );
      unsubscribeUndo.then((_) => _());
      unsubscribeRedo.then((_) => _());
      unsubscribeClear.then((_) => _());
      unsubscribeReset.then((_) => _());
    };
  }, []);
};
