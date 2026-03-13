import { StrokePoint, TextElement } from "@/types";
import { getTextLayout } from "../textLayout";
import { normalizeTextPoints } from "../textGeometry";

export const drawText = (
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  color: string,
  text: TextElement,
  rotation: number = 0
) => {
  const [start, end] = normalizeTextPoints(points, text);
  const bounds = {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
  const { x, y } = bounds;
  const { fontSize, value: textValue } = text;
  ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";

  const layout = getTextLayout(fontSize, textValue);

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  ctx.save();
  if (rotation !== 0) {
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.translate(-centerX, -centerY);
  }

  layout.lines.forEach((line, index) => {
    ctx.fillText(line, x, layout.getLineBaselineY(y, index));
  });
  ctx.restore();
};
