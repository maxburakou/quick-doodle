import { Stroke, StrokePoint, Tool } from "@/types";
import { getStrokeContourSegments } from "../geometry/contours";

export type PointLike = Pick<StrokePoint, "x" | "y">;
export type CanvasSnapBounds = { width: number; height: number };

export interface SnapSegment {
  strokeId: string;
  start: PointLike;
  end: PointLike;
  anchorGroup: "boxEdge" | "lineSegment";
}

const CANVAS_SNAP_ID = "__canvas__";

export const createCanvasBoundaryStroke = ({
  width,
  height,
}: CanvasSnapBounds): Stroke => ({
  id: CANVAS_SNAP_ID,
  points: [
    { x: 0, y: 0, pressure: 0.5 },
    { x: width, y: height, pressure: 0.5 },
  ],
  color: "",
  thickness: 1,
  tool: Tool.Rectangle,
});

export const projectPointToSegment = (
  point: PointLike,
  start: PointLike,
  end: PointLike
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const segmentLengthSq = dx * dx + dy * dy;

  if (segmentLengthSq === 0) {
    const deltaX = point.x - start.x;
    const deltaY = point.y - start.y;
    return {
      projection: { x: start.x, y: start.y },
      distance: Math.hypot(deltaX, deltaY),
    };
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / segmentLengthSq)
  );
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
  const deltaX = point.x - projection.x;
  const deltaY = point.y - projection.y;

  return {
    projection,
    distance: Math.hypot(deltaX, deltaY),
  };
};

export const getStrokeSnapSegments = (stroke: Stroke): SnapSegment[] => {
  return getStrokeContourSegments(stroke).map((segment) => ({
    strokeId: stroke.id,
    start: segment.start,
    end: segment.end,
    anchorGroup: segment.group,
  }));
};

export const getSceneSnapSegments = (
  strokes: Stroke[],
  excludedIds: Set<string>,
  canvasBounds?: CanvasSnapBounds
): SnapSegment[] => {
  const strokeSegments = strokes
    .filter((stroke) => !excludedIds.has(stroke.id))
    .flatMap((stroke) => getStrokeSnapSegments(stroke));
  if (!canvasBounds) return strokeSegments;

  return [
    ...strokeSegments,
    ...getStrokeSnapSegments(createCanvasBoundaryStroke(canvasBounds)),
  ];
};
