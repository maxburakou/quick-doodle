import { Stroke, StrokePoint, Tool } from "@/types";
import {
  getBoundsCenter,
  getStrokeAABB,
  getStrokeBounds,
  getStrokeEndpoints,
  getStrokeRotation,
  rotatePoint,
} from "../core";
import { isLineLikeGeometryTool } from "../toolProfile";

export type AnchorCenterMode = "always" | "filled_only" | "never";
export type StrokeAnchorMode = "auto" | "boxLike" | "lineLike";
export type AnchorGroup = "boxEdge" | "lineSegment";

export type StrokeAnchorKind =
  | "corner"
  | "edgeMid"
  | "center"
  | "ellipseAxis"
  | "lineEnd"
  | "lineMid";

export interface StrokeAnchorPoint extends StrokePoint {
  kind: StrokeAnchorKind;
  anchorGroup: AnchorGroup;
}

export interface StrokeAnchorPolicy {
  centerMode?: AnchorCenterMode;
  mode?: StrokeAnchorMode;
}

const shouldIncludeCenter = (stroke: Stroke, mode: AnchorCenterMode) => {
  if (mode === "always") return true;
  if (mode === "never") return false;
  return Boolean(stroke.shapeFill);
};

const rotateAnchorPoints = (
  points: StrokeAnchorPoint[],
  center: Pick<StrokePoint, "x" | "y">,
  rotation: number
) =>
  points.map((point) => ({
    ...rotatePoint(point, center, rotation),
    kind: point.kind,
    anchorGroup: point.anchorGroup,
  }));

const buildBoxAnchors = (
  bounds: ReturnType<typeof getStrokeBounds>,
  stroke: Stroke,
  centerMode: AnchorCenterMode
): StrokeAnchorPoint[] => {
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);
  const points: StrokeAnchorPoint[] = [
    {
      x: bounds.x,
      y: bounds.y,
      pressure: 0.5,
      kind: "corner",
      anchorGroup: "boxEdge",
    },
    {
      x: bounds.x + bounds.width / 2,
      y: bounds.y,
      pressure: 0.5,
      kind: "edgeMid",
      anchorGroup: "boxEdge",
    },
    {
      x: bounds.x + bounds.width,
      y: bounds.y,
      pressure: 0.5,
      kind: "corner",
      anchorGroup: "boxEdge",
    },
    {
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height / 2,
      pressure: 0.5,
      kind: "edgeMid",
      anchorGroup: "boxEdge",
    },
    {
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height,
      pressure: 0.5,
      kind: "corner",
      anchorGroup: "boxEdge",
    },
    {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height,
      pressure: 0.5,
      kind: "edgeMid",
      anchorGroup: "boxEdge",
    },
    {
      x: bounds.x,
      y: bounds.y + bounds.height,
      pressure: 0.5,
      kind: "corner",
      anchorGroup: "boxEdge",
    },
    {
      x: bounds.x,
      y: bounds.y + bounds.height / 2,
      pressure: 0.5,
      kind: "edgeMid",
      anchorGroup: "boxEdge",
    },
  ];

  if (shouldIncludeCenter(stroke, centerMode)) {
    points.push({
      x: center.x,
      y: center.y,
      pressure: 0.5,
      kind: "center",
      anchorGroup: "boxEdge",
    });
  }

  return rotateAnchorPoints(points, center, rotation);
};

const buildLineLikeAnchors = (stroke: Stroke): StrokeAnchorPoint[] => {
  const [start, end] = getStrokeEndpoints(stroke);

  return [
    { ...start, kind: "lineEnd", anchorGroup: "lineSegment" },
    { ...end, kind: "lineEnd", anchorGroup: "lineSegment" },
    {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      pressure: 0.5,
      kind: "lineMid",
      anchorGroup: "lineSegment",
    },
  ];
};

const resolveStrokeAnchorMode = (
  stroke: Stroke,
  policyMode: StrokeAnchorMode
): Exclude<StrokeAnchorMode, "auto"> => {
  if (policyMode === "lineLike" || policyMode === "boxLike") {
    return policyMode;
  }

  if (isLineLikeGeometryTool(stroke.tool)) {
    return "lineLike";
  }

  return "boxLike";
};

export const getStrokeAnchorPoints = (
  stroke: Stroke,
  policy?: StrokeAnchorPolicy
): StrokeAnchorPoint[] => {
  const centerMode = policy?.centerMode ?? "always";
  const mode = resolveStrokeAnchorMode(stroke, policy?.mode ?? "auto");

  if (mode === "lineLike") {
    return buildLineLikeAnchors(stroke);
  }

  if (stroke.tool === Tool.Pen) {
    const bounds = getStrokeAABB(stroke);
    return buildBoxAnchors(bounds, stroke, centerMode);
  }

  if (
    stroke.tool === Tool.Text ||
    stroke.tool === Tool.Rectangle ||
    stroke.tool === Tool.Diamond ||
    stroke.tool === Tool.Ellipse
  ) {
    const bounds = getStrokeBounds(stroke);
    return buildBoxAnchors(bounds, stroke, centerMode);
  }

  return [];
};
