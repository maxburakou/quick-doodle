import getStroke from "perfect-freehand";
import { StrokePoint } from "@/types";

export const drawPenStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: StrokePoint[],
  color: string,
  thickness: number
) => {
  ctx.beginPath();
  const strokePath = getStroke(
    stroke.map(({ x, y }) => [x, y]),
    {
      size: thickness,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      easing: (t) => Math.sin((t * Math.PI) / 2),
      start: {
        cap: true,
        taper: 0,
        easing: (t) => t,
      },
      end: {
        cap: true,
        taper: 0,
        easing: (t) => t,
      },
    }
  );

  if (strokePath.length > 0) {
    ctx.moveTo(strokePath[0][0], strokePath[0][1]);
    for (let i = 1; i < strokePath.length - 1; i++) {
      const [x0, y0] = strokePath[i];
      const [x1, y1] = strokePath[i + 1];
      const xc = (x0 + x1) / 2;
      const yc = (y0 + y1) / 2;
      ctx.quadraticCurveTo(x0, y0, xc, yc);
    }
  }

  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};
