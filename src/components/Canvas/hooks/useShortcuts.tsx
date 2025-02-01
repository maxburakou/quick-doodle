import { useEffect } from "react";
import { ReactSketchCanvasRef } from "react-sketch-canvas";
import { handleCanvasEvent, handleKeyDownEvent } from "../helpers";

export const useShortcuts = (
  canvasRef: React.RefObject<ReactSketchCanvasRef>
) => {
  useEffect(() => {
    const shortcutHandler = (event: KeyboardEvent) =>
      handleKeyDownEvent(event, canvasRef);

    window.addEventListener("keydown", shortcutHandler);

    const unsubscribeUndo = handleCanvasEvent("undo-canvas", () =>
      canvasRef.current?.undo()
    );
    const unsubscribeReset = handleCanvasEvent("reset-canvas", () =>
      canvasRef.current?.resetCanvas()
    );
    const unsubscribeClear = handleCanvasEvent("clear-canvas", () =>
      canvasRef.current?.clearCanvas()
    );
    const unsubscribeRedo = handleCanvasEvent("redo-canvas", () =>
      canvasRef.current?.redo()
    );

    return () => {
      window.removeEventListener("keydown", shortcutHandler);
      unsubscribeUndo.then((_) => _());
      unsubscribeRedo.then((_) => _());
      unsubscribeClear.then((_) => _());
      unsubscribeReset.then((_) => _());
    };
  }, [canvasRef]);
};
