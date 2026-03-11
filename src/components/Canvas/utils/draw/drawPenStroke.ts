import { StrokePoint } from "@/types";
import { PEN_STROKE_OPTIONS } from "../penStrokeOptions";
import getStroke from "perfect-freehand";

export const drawPenStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: StrokePoint[],
  color: string,
  thickness: number,
  cachedPolygon?: number[][] | null
) => {
  const strokePath = cachedPolygon ?? getStroke(
    stroke.map(({ x, y }) => [x, y]),
    { ...PEN_STROKE_OPTIONS, size: thickness }
  );

  if (strokePath.length === 0) return;

  ctx.beginPath();
  ctx.moveTo(strokePath[0][0], strokePath[0][1]);
  for (let i = 1; i < strokePath.length - 1; i++) {
    const [x0, y0] = strokePath[i];
    const [x1, y1] = strokePath[i + 1];
    const xc = (x0 + x1) / 2;
    const yc = (y0 + y1) / 2;
    ctx.quadraticCurveTo(x0, y0, xc, yc);
  }

  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};
