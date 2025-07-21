import { StrokePoint, TextElement } from "@/types";

export const drawText = (
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  color: string,
  text: TextElement
) => {
  const { x, y } = points[0];
  const { fontSize, value: textValue } = text;
  ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";

  const lines = textValue.split("\n");
  // todo: get line height from font
  const lineHeight = fontSize * 1.1;

  const correction = Math.round(fontSize * 0.08333 + 1.6667);

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight - correction);
  });
};
