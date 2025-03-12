import { MutableRefObject, useEffect } from "react";

export const useCanvasScaleSetup = (
  canvasRef: MutableRefObject<HTMLCanvasElement | null>,
  ctxRef: MutableRefObject<CanvasRenderingContext2D | null>
) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);
        ctxRef.current = ctx;
      }
    }
  }, [canvasRef, ctxRef]);
};
