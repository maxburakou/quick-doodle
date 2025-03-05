import { ReactSketchCanvasRef } from "react-sketch-canvas";
import { toggleBackground } from "./toggleBackground";

export const handleKeyDownEvent = (
  event: KeyboardEvent,
  canvasRef: React.RefObject<ReactSketchCanvasRef>
) => {
  event.preventDefault();

  if (event.shiftKey && event.metaKey && event.key === "z") {
    canvasRef.current?.redo();
    return;
  }

  if (event.metaKey && event.key === "z") {
    canvasRef.current?.undo();
    return;
  }

  if (event.metaKey && event.key === "c") {
    canvasRef.current?.clearCanvas();
    return;
  }

  if (event.metaKey && event.key === "r") {
    canvasRef.current?.resetCanvas();
    return;
  }

  if (event.metaKey && event.key === "a") {
    toggleBackground();
    return;
  }
};
