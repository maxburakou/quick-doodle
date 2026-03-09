import { Stroke, StrokePoint, Tool } from "@/types";
import {
  getBoundsCenter,
  getStrokeAABB,
  getStrokeBounds,
  getStrokeEndpoints,
  getStrokeRotation,
  rotatePoint,
} from "../core";
import {
  getDiamondContourPoints,
  getRectangleContourPoints,
  getStrokeContourSegments,
} from "./contours";
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

const createAnchor = (
  point: Pick<StrokePoint, "x" | "y">,
  kind: StrokeAnchorKind,
  anchorGroup: AnchorGroup = "boxEdge"
): StrokeAnchorPoint => ({
  x: point.x,
  y: point.y,
  pressure: 0.5,
  kind,
  anchorGroup,
});

const appendCenterAnchor = (
  anchors: StrokeAnchorPoint[],
  stroke: Stroke,
  bounds: ReturnType<typeof getStrokeBounds> | ReturnType<typeof getStrokeAABB>,
  centerMode: AnchorCenterMode
) => {
  if (!shouldIncludeCenter(stroke, centerMode)) {
    return anchors;
  }

  return [...anchors, createAnchor(getBoundsCenter(bounds), "center")];
};

const buildRotatedBoxAnchors = (
  bounds: ReturnType<typeof getStrokeBounds> | ReturnType<typeof getStrokeAABB>,
  stroke: Stroke,
  centerMode: AnchorCenterMode
): StrokeAnchorPoint[] => {
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);
  const points: StrokeAnchorPoint[] = [
    createAnchor({ x: bounds.x, y: bounds.y }, "corner"),
    createAnchor({ x: bounds.x + bounds.width / 2, y: bounds.y }, "edgeMid"),
    createAnchor({ x: bounds.x + bounds.width, y: bounds.y }, "corner"),
    createAnchor(
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
      "edgeMid"
    ),
    createAnchor(
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      "corner"
    ),
    createAnchor(
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
      "edgeMid"
    ),
    createAnchor({ x: bounds.x, y: bounds.y + bounds.height }, "corner"),
    createAnchor({ x: bounds.x, y: bounds.y + bounds.height / 2 }, "edgeMid"),
  ];

  const withCenter = appendCenterAnchor(points, stroke, bounds, centerMode);

  return withCenter.map((point) => ({
    ...rotatePoint(point, center, rotation),
    kind: point.kind,
    anchorGroup: point.anchorGroup,
  }));
};

const buildRectangleAnchors = (
  stroke: Stroke,
  centerMode: AnchorCenterMode
): StrokeAnchorPoint[] => {
  const corners = getRectangleContourPoints(stroke);
  if (corners.length !== 4) return [];

  const anchors: StrokeAnchorPoint[] = [];
  for (let index = 0; index < corners.length; index += 1) {
    const start = corners[index];
    const end = corners[(index + 1) % corners.length];
    if (!start || !end) continue;

    anchors.push(createAnchor(start, "corner"));
    anchors.push(
      createAnchor(
        {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2,
        },
        "edgeMid"
      )
    );
  }

  return appendCenterAnchor(anchors, stroke, getStrokeBounds(stroke), centerMode);
};

const buildDiamondAnchors = (
  stroke: Stroke,
  centerMode: AnchorCenterMode
): StrokeAnchorPoint[] => {
  const corners = getDiamondContourPoints(stroke);
  if (corners.length !== 4) return [];

  const anchors: StrokeAnchorPoint[] = [];
  for (let index = 0; index < corners.length; index += 1) {
    const start = corners[index];
    const end = corners[(index + 1) % corners.length];
    if (!start || !end) continue;

    anchors.push(createAnchor(start, "corner"));
    anchors.push(
      createAnchor(
        {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2,
        },
        "edgeMid"
      )
    );
  }

  return appendCenterAnchor(anchors, stroke, getStrokeBounds(stroke), centerMode);
};

const buildEllipseAnchors = (
  stroke: Stroke,
  centerMode: AnchorCenterMode
): StrokeAnchorPoint[] => {
  const contourPoints = getStrokeContourSegments(stroke).map(
    (segment) => segment.start
  );
  if (contourPoints.length < 8) return [];

  const anchors: StrokeAnchorPoint[] = [];
  for (let index = 0; index < 8; index += 1) {
    const contourIndex = Math.round((index * contourPoints.length) / 8) % contourPoints.length;
    const point = contourPoints[contourIndex];
    if (!point) continue;
    anchors.push(createAnchor(point, "ellipseAxis"));
  }

  return appendCenterAnchor(anchors, stroke, getStrokeBounds(stroke), centerMode);
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
    return buildRotatedBoxAnchors(getStrokeAABB(stroke), stroke, centerMode);
  }

  if (stroke.tool === Tool.Text) {
    return buildRotatedBoxAnchors(getStrokeBounds(stroke), stroke, centerMode);
  }

  if (stroke.tool === Tool.Rectangle) {
    return buildRectangleAnchors(stroke, centerMode);
  }

  if (stroke.tool === Tool.Diamond) {
    return buildDiamondAnchors(stroke, centerMode);
  }

  if (stroke.tool === Tool.Ellipse) {
    return buildEllipseAnchors(stroke, centerMode);
  }

  return [];
};
