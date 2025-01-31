import { useEffect } from "react";
import { ReactSketchCanvasRef } from "react-sketch-canvas";
import { listen } from "@tauri-apps/api/event";

export const useRedo = (canvasRef: React.RefObject<ReactSketchCanvasRef>) => {
  useEffect(() => {
    const unsubscribe = listen("redo", (event) => {
      console.log("Received event:", event.payload);
      canvasRef.current?.redo();
    });

    return () => {
      unsubscribe.then((_) => _());
    };
  }, [canvasRef]);
};
