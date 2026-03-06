import { Stroke, StrokePoint, Tool } from "@/types";
import {
  getBoundsCenter,
  getStrokeAABB,
  getStrokeBounds,
  getStrokeRotation,
  rotatePoint,
} from "../core";
import { getStrokeAnchorPoints } from "../geometry/anchors";
import { isLineLikeGeometryTool } from "../toolProfile";

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

const getBoxSnapSegments = (stroke: Stroke): SnapSegment[] => {
  const bounds = stroke.tool === Tool.Pen ? getStrokeAABB(stroke) : getStrokeBounds(stroke);
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].map((point) => rotatePoint(point, center, rotation));

  return [
    {
      strokeId: stroke.id,
      start: corners[0],
      end: corners[1],
      anchorGroup: "boxEdge",
    },
    {
      strokeId: stroke.id,
      start: corners[1],
      end: corners[2],
      anchorGroup: "boxEdge",
    },
    {
      strokeId: stroke.id,
      start: corners[2],
      end: corners[3],
      anchorGroup: "boxEdge",
    },
    {
      strokeId: stroke.id,
      start: corners[3],
      end: corners[0],
      anchorGroup: "boxEdge",
    },
  ];
};

export const getStrokeSnapSegments = (stroke: Stroke): SnapSegment[] => {
  if (isLineLikeGeometryTool(stroke.tool)) {
    const points = getStrokeAnchorPoints(stroke, { mode: "lineLike", centerMode: "never" });
    const start = points.find((point) => point.kind === "lineEnd");
    const end = points
      .slice()
      .reverse()
      .find((point) => point.kind === "lineEnd");
    if (!start || !end) return [];

    return [
      {
        strokeId: stroke.id,
        start,
        end,
        anchorGroup: "lineSegment",
      },
    ];
  }

  if (
    stroke.tool === Tool.Rectangle ||
    stroke.tool === Tool.Diamond ||
    stroke.tool === Tool.Ellipse ||
    stroke.tool === Tool.Text ||
    stroke.tool === Tool.Pen
  ) {
    return getBoxSnapSegments(stroke);
  }

  return [];
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
