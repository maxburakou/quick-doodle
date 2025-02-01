import { useEffect } from "react";
import { ReactSketchCanvasRef } from "react-sketch-canvas";
import { listen } from "@tauri-apps/api/event";

export const useUndo = (canvasRef: React.RefObject<ReactSketchCanvasRef>) => {
  useEffect(() => {
    const unsubscribe = listen("undo-canvas", (event) => {
      console.log("Received event:", event.payload);
      canvasRef.current?.undo();
    });

    return () => {
      unsubscribe.then((_) => _());
    } 
  }, [canvasRef]);
};
