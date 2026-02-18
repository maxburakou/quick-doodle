import { Stroke, Tool } from "@/types";
import {
  getBoundsCenter,
  getStrokeBounds,
  getStrokeEndpoints,
  getStrokeTransformHandles,
  getStrokeRotation,
  rotatePoint,
} from "@/store/useShapeEditorStore/helpers";

const BOX_COLOR = "#0f62fe";
const HANDLE_FILL = "#ffffff";
const HANDLE_STROKE = "#0f62fe";

export const drawShapeEditorOverlay = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke
) => {
  const [start, end] = getStrokeEndpoints(stroke);

  ctx.save();
  ctx.strokeStyle = BOX_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  if (stroke.tool === Tool.Pen || stroke.tool === Tool.Highlighter) {
    const points = stroke.points;

    if (points.length > 0) {
      let minX = points[0].x;
      let maxX = points[0].x;
      let minY = points[0].y;
      let maxY = points[0].y;

      points.forEach((point) => {
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
      });

      const padding = Math.max(6, stroke.thickness * 2);
      ctx.strokeRect(
        minX - padding,
        minY - padding,
        maxX - minX + padding * 2,
        maxY - minY + padding * 2
      );
    }
  } else if (stroke.tool === Tool.Line || stroke.tool === Tool.Arrow) {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  } else {
    const bounds = getStrokeBounds(stroke);
    const center = getBoundsCenter(bounds);
    const rotation = getStrokeRotation(stroke);

    const corners = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height },
    ].map((point) => rotatePoint(point, center, rotation));

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i += 1) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.setLineDash([]);

  if (stroke.tool === Tool.Pen || stroke.tool === Tool.Highlighter) {
    ctx.restore();
    return;
  }

  const handles = getStrokeTransformHandles(stroke);
  handles.forEach(({ point, handle }) => {
    ctx.beginPath();
    if (handle === "rotate") {
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = BOX_COLOR;
      ctx.fill();
      return;
    }

    ctx.fillStyle = HANDLE_FILL;
    ctx.strokeStyle = HANDLE_STROKE;
    ctx.rect(point.x - 4, point.y - 4, 8, 8);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
};
