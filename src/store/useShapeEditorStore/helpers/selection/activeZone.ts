import { ShapeBounds, Stroke, StrokePoint, Tool } from "@/types";
import { hitTestText } from "@/components/Canvas/utils/textGeometry";
import {
  ACTIVE_ZONE_PX,
  MARQUEE_MAX_SAMPLING_POINTS,
  MARQUEE_SAMPLING_STEP_PX,
} from "@/config/selectionConfig";
import {
  getStrokeAABB,
  isEditableShapeTool,
} from "../core";
import {
  type ContourSegment,
  getStrokeContourSegments,
} from "../geometry/contours";
import { segmentIntersectsRect } from "../geometry/intersections";
import { isPointInStrokeVisuals } from "@/components/Canvas/utils/visualHitTest";

const intersectsBounds = (a: ShapeBounds, b: ShapeBounds) =>
  a.x <= b.x + b.width &&
  a.x + a.width >= b.x &&
  a.y <= b.y + b.height &&
  a.y + a.height >= b.y;

const expandBounds = (bounds: ShapeBounds, padding: number): ShapeBounds => ({
  x: bounds.x - padding,
  y: bounds.y - padding,
  width: bounds.width + padding * 2,
  height: bounds.height + padding * 2,
});

const getBoundsIntersection = (a: ShapeBounds, b: ShapeBounds): ShapeBounds | null => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = right - x;
  const height = bottom - y;

  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
};

const getMarqueeCorners = (bounds: ShapeBounds): StrokePoint[] => [
  { x: bounds.x, y: bounds.y, pressure: 0.5 },
  { x: bounds.x + bounds.width, y: bounds.y, pressure: 0.5 },
  {
    x: bounds.x + bounds.width,
    y: bounds.y + bounds.height,
    pressure: 0.5,
  },
  { x: bounds.x, y: bounds.y + bounds.height, pressure: 0.5 },
];

const getStrokeActiveZonePadding = (stroke: Stroke) => {
  if (stroke.tool === Tool.Highlighter) return 0;
  return ACTIVE_ZONE_PX;
};



export const isPointInActiveZone = (stroke: Stroke, point: StrokePoint): boolean => {
  if (!isEditableShapeTool(stroke.tool)) return false;

  if (stroke.tool === Tool.Text) {
    return hitTestText(stroke, point, ACTIVE_ZONE_PX);
  }

  return isPointInStrokeVisuals(stroke, point);
};

const hasContourRectIntersection = (
  segments: ContourSegment[],
  rect: ShapeBounds
) =>
  segments.some((segment) => segmentIntersectsRect(segment.start, segment.end, rect));

const hasCornerBasedIntersection = (
  stroke: Stroke,
  rectCorners: StrokePoint[]
) => {
  return rectCorners.some((corner) => isPointInActiveZone(stroke, corner));
};

const sampleIntersectionWithActiveZone = (stroke: Stroke, area: ShapeBounds) => {
  let checks = 0;
  const maxX = area.x + area.width;
  const maxY = area.y + area.height;

  for (
    let y = area.y;
    y <= maxY && checks < MARQUEE_MAX_SAMPLING_POINTS;
    y += MARQUEE_SAMPLING_STEP_PX
  ) {
    for (
      let x = area.x;
      x <= maxX && checks < MARQUEE_MAX_SAMPLING_POINTS;
      x += MARQUEE_SAMPLING_STEP_PX
    ) {
      checks += 1;
      if (isPointInActiveZone(stroke, { x, y, pressure: 0.5 })) {
        return true;
      }
    }
  }

  return false;
};

export const doesActiveZoneIntersectRect = (
  stroke: Stroke,
  rect: ShapeBounds
): boolean => {
  const activeAABB = expandBounds(
    getStrokeAABB(stroke),
    getStrokeActiveZonePadding(stroke)
  );
  if (!intersectsBounds(activeAABB, rect)) return false;

  const contourSegments = getStrokeContourSegments(stroke);
  if (hasContourRectIntersection(contourSegments, rect)) {
    return true;
  }

  const rectCorners = getMarqueeCorners(rect);
  if (hasCornerBasedIntersection(stroke, rectCorners)) {
    return true;
  }

  const intersection = getBoundsIntersection(activeAABB, rect);
  if (!intersection) return false;

  return sampleIntersectionWithActiveZone(stroke, intersection);
};
