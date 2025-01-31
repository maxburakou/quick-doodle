import {
  ReactSketchCanvas,
  type ReactSketchCanvasRef,
} from "react-sketch-canvas";
import { useRef } from "react";
import { useClear, useRedo, useReset, useUndo } from "./hooks";

const CanvasStyles = {
  border: "none",
  cursor: "crosshair",
};

export const Canvas = () => {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);

  useUndo(canvasRef);
  useRedo(canvasRef);
  useClear(canvasRef);
  useReset(canvasRef);

  return (
    <ReactSketchCanvas
      ref={canvasRef}
      canvasColor="transparent"
      strokeColor="#a855f7"
      style={CanvasStyles}
    />
  );
};
