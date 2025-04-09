import { Stroke } from "@/types";
import { drawStrokes } from "../utils";

export const drawCanvas = (
  strokes: Stroke[],
  ctx: CanvasRenderingContext2D | null,
) => {
  if (!ctx) return;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawStrokes(strokes, ctx);
};