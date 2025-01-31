import { useEffect } from "react";
import { ReactSketchCanvasRef } from "react-sketch-canvas";
import { listen } from "@tauri-apps/api/event";

export const useReset = (canvasRef: React.RefObject<ReactSketchCanvasRef>) => {
  useEffect(() => {
    const unsubscribe = listen("reset", (event) => {
      console.log("Received event:", event.payload);
      canvasRef.current?.resetCanvas();
    });

    return () => {
      unsubscribe.then((_) => _());
    };
  }, [canvasRef]);
};
