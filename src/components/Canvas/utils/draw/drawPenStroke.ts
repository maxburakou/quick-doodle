import getStroke from "perfect-freehand";
import { StrokePoint } from "../../../../types";

export const drawPenStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: StrokePoint[],
  thickness: number,
  color: string
) => {
  ctx.beginPath();
  const strokePath = getStroke(
    stroke.map(({ x, y }) => [x, y]),
    {
      size: thickness,
      thinning: 0.5,
      smoothing: 0.6,
      streamline: 0.6,
    }
  );

  if (strokePath.length > 0) {
    ctx.moveTo(strokePath[0][0], strokePath[0][1]);
    strokePath.forEach(([x, y]) => ctx.lineTo(x, y));
  }
  ctx.fillStyle = color;
  ctx.fill();
};
