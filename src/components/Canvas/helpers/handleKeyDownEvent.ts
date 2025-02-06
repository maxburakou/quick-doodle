import { ReactSketchCanvasRef } from "react-sketch-canvas";

export const handleKeyDownEvent = (
  event: KeyboardEvent,
  canvasRef: React.RefObject<ReactSketchCanvasRef>
) => {
  if (event.shiftKey && event.metaKey && event.key === "z") {
    event.preventDefault();
    canvasRef.current?.redo();
    return;
  }

  if (event.metaKey && event.key === "z") {
    event.preventDefault();
    canvasRef.current?.undo();
    return;
  }

  if (event.metaKey && event.key === "c") {
    event.preventDefault();
    canvasRef.current?.clearCanvas();
    return;
  }

  if (event.metaKey && event.key === "r") {
    event.preventDefault();
    canvasRef.current?.resetCanvas();
    return;
  }
};
