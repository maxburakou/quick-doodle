import { ReactSketchCanvas } from "react-sketch-canvas";

const CanvasStyles = {
  border: 'none',
  cursor: 'crosshair',
};

export const Canvas = () => {
  return (
    <ReactSketchCanvas
      canvasColor="transparent"
      strokeColor="#a855f7"
      style={CanvasStyles}
    />
  );
};
