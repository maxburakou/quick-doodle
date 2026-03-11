import { Stroke, StrokePoint, Tool } from "@/types";
import { ACTIVE_ZONE_PX } from "@/config/selectionConfig";
import { constrainToSquareBounds } from "./constrainToSquareBounds";
import { constrainLineToAxis } from "./constrainLineToAxis";
import { getStrokeRotation, inverseRotatePoint } from "@/store/useShapeEditorStore/helpers/core";
import { getHighlighterStrokeWidth } from "./draw/drawHighlighter";
import { getCachedStrokeGeometry } from "./strokeShapeCache";

let hitTestCanvas: HTMLCanvasElement | null = null;
let hitTestCtx: CanvasRenderingContext2D | null = null;

const getHitTestCtx = () => {
  if (typeof document === "undefined") return null;
  if (!hitTestCtx) {
    hitTestCanvas = document.createElement("canvas");
    hitTestCtx = hitTestCanvas.getContext("2d");
  }
  return hitTestCtx;
};

const getLineLikeActiveZoneTolerance = () => {
  return ACTIVE_ZONE_PX;
};

export const isPointInStrokeVisuals = (stroke: Stroke, pointer: StrokePoint): boolean => {
  const tolerance = getLineLikeActiveZoneTolerance();

  if (stroke.tool === Tool.Pen) {
    const { hitTestPath } = getCachedStrokeGeometry(stroke);
    if (!hitTestPath) return false;

    const ctx = getHitTestCtx();
    if (!ctx) return false;

    ctx.lineWidth = tolerance * 2;
    return (
      ctx.isPointInPath(hitTestPath, pointer.x, pointer.y) ||
      ctx.isPointInStroke(hitTestPath, pointer.x, pointer.y)
    );
  }

  if (stroke.tool === Tool.Highlighter) {
    const start = stroke.points[0];
    const rawEnd = stroke.points[stroke.points.length - 1] ?? start;
    const end = stroke.isShiftPressed ? constrainToSquareBounds(start, rawEnd) : rawEnd;

    const path = new Path2D();
    path.moveTo(start.x, start.y);
    path.lineTo(end.x, end.y);

    const ctx = getHitTestCtx();
    if (!ctx) return false;

    ctx.lineWidth = getHighlighterStrokeWidth(stroke.thickness);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx.isPointInStroke(path, pointer.x, pointer.y);
  }

  
  const { hitTestPath } = getCachedStrokeGeometry(stroke);
  if (!hitTestPath) return false;

  const start = stroke.points[0];
  const rawEnd = stroke.points[stroke.points.length - 1] ?? start;
  let end = rawEnd;
  if (stroke.isShiftPressed) {
    if (stroke.tool === Tool.Line) end = constrainLineToAxis(start, rawEnd);
    else if (stroke.tool !== Tool.Arrow) end = constrainToSquareBounds(start, rawEnd);
  }

  const rotation = getStrokeRotation(stroke);
  let testPoint = pointer;

  if (rotation !== 0) {
    const geometricCenterX = (start.x + end.x) / 2;
    const geometricCenterY = (start.y + end.y) / 2;
    const center = { x: geometricCenterX, y: geometricCenterY };
    testPoint = inverseRotatePoint(pointer, center, rotation);
  }

  const ctx = getHitTestCtx();
  if (!ctx) return false;

  ctx.lineWidth = stroke.thickness + tolerance * 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  let isHit = ctx.isPointInStroke(hitTestPath, testPoint.x, testPoint.y);

  if (!isHit && stroke.shapeFill && stroke.tool !== Tool.Line && stroke.tool !== Tool.Arrow) {
    isHit = ctx.isPointInPath(hitTestPath, testPoint.x, testPoint.y);
  }

  return isHit;
};
