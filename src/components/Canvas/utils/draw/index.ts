import { Stroke, Tool } from "@/types";
import { drawArrow } from "./drawArrow";
import { drawEllipse } from "./drawEllipse";
import { drawHighlighter } from "./drawHighlighter";
import { drawLine } from "./drawLine";
import { drawPenStroke } from "./drawPenStroke";
import { drawRectangle } from "./drawRectangle";
import { drawDiamond } from "./drawDiamond";
import { drawText } from "./drawText";

export { drawLine } from "./drawLine";
export { drawRectangle } from "./drawRectangle";
export { drawEllipse } from "./drawEllipse";
export { drawArrow } from "./drawArrow";
export { drawPenStroke } from "./drawPenStroke";
export { drawHighlighter } from "./drawHighlighter";
export { drawDiamond } from "./drawDiamond";
export { drawText } from "./drawText";

export const drawStrokes = (
  strokes: Stroke[],
  ctx: CanvasRenderingContext2D
) => {
  strokes.forEach(
    ({
      points,
      color,
      thickness,
      tool,
      drawableSeed,
      isShiftPressed,
      text,
    }) => {
      const hasMinimumPoints = points.length >= 2;

      if (tool === Tool.Pen) {
        drawPenStroke(ctx, points, color, thickness);
        return;
      }

      if (tool === Tool.Highlighter && hasMinimumPoints) {
        drawHighlighter(
          ctx,
          points[0],
          points[points.length - 1],
          color,
          thickness,
          isShiftPressed
        );
        return;
      }

      if (tool === Tool.Arrow && hasMinimumPoints) {
        drawArrow(
          ctx,
          points[0],
          points[points.length - 1],
          color,
          thickness,
          drawableSeed,
          isShiftPressed
        );
        return;
      }

      if (tool === Tool.Line && hasMinimumPoints) {
        drawLine(
          ctx,
          points[0],
          points[points.length - 1],
          color,
          thickness,
          drawableSeed,
          isShiftPressed
        );
        return;
      }

      if (tool === Tool.Rectangle && hasMinimumPoints) {
        drawRectangle(
          ctx,
          points[0],
          points[points.length - 1],
          color,
          thickness,
          drawableSeed,
          isShiftPressed
        );
        return;
      }

      if (tool === Tool.Ellipse && hasMinimumPoints) {
        drawEllipse(
          ctx,
          points[0],
          points[points.length - 1],
          color,
          thickness,
          drawableSeed,
          isShiftPressed
        );
        return;
      }

      if (tool === Tool.Diamond && hasMinimumPoints) {
        drawDiamond(
          ctx,
          points[0],
          points[points.length - 1],
          color,
          thickness,
          drawableSeed,
          isShiftPressed
        );
        return;
      }

      if (tool === Tool.Text && text) {
        drawText(ctx, points, color, text);
        return;
      }
    }
  );
};
