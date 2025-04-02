import { StrokePoint } from "@/types";

export const drawText = (
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  color: string,
  fontSize: number,
  text: string
) => {
  const { x, y } = points[0];
  ctx.font = `${fontSize}px 'Virgil', sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";

  const lines = text.split("\n");
  const lineHeight = fontSize;

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
};
