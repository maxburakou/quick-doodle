import {
  ReactSketchCanvas,
  type ReactSketchCanvasRef,
} from "react-sketch-canvas";
import { useRef } from "react";
import { useShortcuts } from "./hooks";

const CanvasStyles = {
  border: "none",
  cursor: "crosshair",
};

export const Canvas = () => {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  useShortcuts(canvasRef);

  return (
    <ReactSketchCanvas
      ref={canvasRef}
      canvasColor="transparent"
      strokeColor="#a855f7"
      style={CanvasStyles}
    />
  );
};
