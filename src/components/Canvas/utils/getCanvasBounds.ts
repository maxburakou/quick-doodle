import React from "react";

export const getCanvasBoundsFromCtx = (
  ctxRef: React.MutableRefObject<CanvasRenderingContext2D | null>
) => {
  const canvas = ctxRef.current?.canvas;
  return {
    width: canvas?.clientWidth ?? window.innerWidth,
    height: canvas?.clientHeight ?? window.innerHeight,
  };
};
