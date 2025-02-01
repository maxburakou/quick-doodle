import { useEffect } from "react";
import { ReactSketchCanvasRef } from "react-sketch-canvas";
import { listen } from "@tauri-apps/api/event";

export const useClear = (canvasRef: React.RefObject<ReactSketchCanvasRef>) => {
  useEffect(() => {
    const unsubscribe = listen("clear-canvas", (event) => {
      console.log("Received event:", event.payload);
      canvasRef.current?.clearCanvas();
    });

    return () => {
      unsubscribe.then((_) => _());
    };
  }, [canvasRef]);
};
