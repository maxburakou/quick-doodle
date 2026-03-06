import { Stroke, StrokePoint, Tool } from "@/types";
import { ELLIPSE_ANCHOR_ANGLES } from "@/config/snapConfig";
import {
  getBoundsCenter,
  getStrokeAABB,
  getStrokeBounds,
  getStrokeEndpoints,
  getStrokeRotation,
  rotatePoint,
} from "./core";

export type AnchorCenterMode = "always" | "filled_only" | "never";
export type PenAnchorMode = "path" | "bbox";
export type HighlighterAnchorMode = "shape" | "box";

export type StrokeAnchorKind =
  | "corner"
  | "edgeMid"
  | "center"
  | "ellipseAxis"
  | "lineEnd"
  | "lineMid"
  | "path";

export interface StrokeAnchorPoint extends StrokePoint {
  kind: StrokeAnchorKind;
}

export interface StrokeAnchorPolicy {
  centerMode?: AnchorCenterMode;
  penMode?: PenAnchorMode;
  penStride?: number;
  includePenLast?: boolean;
  highlighterMode?: HighlighterAnchorMode;
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
  }));

const buildBoxAnchors = (
  bounds: ReturnType<typeof getStrokeBounds>,
  stroke: Stroke,
  centerMode: AnchorCenterMode
): StrokeAnchorPoint[] => {
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);
  const points: StrokeAnchorPoint[] = [
    { x: bounds.x, y: bounds.y, pressure: 0.5, kind: "corner" },
    {
      x: bounds.x + bounds.width / 2,
      y: bounds.y,
      pressure: 0.5,
      kind: "edgeMid",
    },
    { x: bounds.x + bounds.width, y: bounds.y, pressure: 0.5, kind: "corner" },
    {
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height / 2,
      pressure: 0.5,
      kind: "edgeMid",
    },
    {
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height,
      pressure: 0.5,
      kind: "corner",
    },
    {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height,
      pressure: 0.5,
      kind: "edgeMid",
    },
    {
      x: bounds.x,
      y: bounds.y + bounds.height,
      pressure: 0.5,
      kind: "corner",
    },
    {
      x: bounds.x,
      y: bounds.y + bounds.height / 2,
      pressure: 0.5,
      kind: "edgeMid",
    },
  ];

  if (shouldIncludeCenter(stroke, centerMode)) {
    points.push({ x: center.x, y: center.y, pressure: 0.5, kind: "center" });
  }

  return rotateAnchorPoints(points, center, rotation);
};

const buildDiamondAnchors = (
  bounds: ReturnType<typeof getStrokeBounds>,
  stroke: Stroke,
  centerMode: AnchorCenterMode
): StrokeAnchorPoint[] => {
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);
  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;
  const points: StrokeAnchorPoint[] = [
    { x: center.x, y: center.y - halfHeight, pressure: 0.5, kind: "corner" },
    { x: center.x + halfWidth, y: center.y, pressure: 0.5, kind: "corner" },
    { x: center.x, y: center.y + halfHeight, pressure: 0.5, kind: "corner" },
    { x: center.x - halfWidth, y: center.y, pressure: 0.5, kind: "corner" },
    {
      x: center.x + halfWidth / 2,
      y: center.y - halfHeight / 2,
      pressure: 0.5,
      kind: "edgeMid",
    },
    {
      x: center.x + halfWidth / 2,
      y: center.y + halfHeight / 2,
      pressure: 0.5,
      kind: "edgeMid",
    },
    {
      x: center.x - halfWidth / 2,
      y: center.y + halfHeight / 2,
      pressure: 0.5,
      kind: "edgeMid",
    },
    {
      x: center.x - halfWidth / 2,
      y: center.y - halfHeight / 2,
      pressure: 0.5,
      kind: "edgeMid",
    },
  ];

  if (shouldIncludeCenter(stroke, centerMode)) {
    points.push({ x: center.x, y: center.y, pressure: 0.5, kind: "center" });
  }

  return rotateAnchorPoints(points, center, rotation);
};

const buildEllipseAnchors = (
  bounds: ReturnType<typeof getStrokeBounds>,
  stroke: Stroke,
  centerMode: AnchorCenterMode
): StrokeAnchorPoint[] => {
  const center = getBoundsCenter(bounds);
  const rotation = getStrokeRotation(stroke);
  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;
  const points: StrokeAnchorPoint[] = ELLIPSE_ANCHOR_ANGLES.map((angleDeg) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: center.x + Math.cos(angleRad) * halfWidth,
      y: center.y + Math.sin(angleRad) * halfHeight,
      pressure: 0.5,
      kind: "ellipseAxis",
    };
  });

  if (shouldIncludeCenter(stroke, centerMode)) {
    points.push({ x: center.x, y: center.y, pressure: 0.5, kind: "center" });
  }

  return rotateAnchorPoints(points, center, rotation);
};

const decimatePenPoints = (
  points: StrokePoint[],
  stride: number,
  includeLast: boolean
): StrokeAnchorPoint[] => {
  if (points.length === 0) return [];
  const step = Math.max(1, stride);
  const output: StrokeAnchorPoint[] = [];

  for (let index = 0; index < points.length; index += step) {
    const point = points[index];
    if (!point) continue;
    output.push({ ...point, kind: "path" });
  }

  if (includeLast) {
    const last = points[points.length - 1];
    const lastOut = output[output.length - 1];
    if (last && (!lastOut || last.x !== lastOut.x || last.y !== lastOut.y)) {
      output.push({ ...last, kind: "path" });
    }
  }

  return output;
};

export const getStrokeAnchorPoints = (
  stroke: Stroke,
  policy?: StrokeAnchorPolicy
): StrokeAnchorPoint[] => {
  const centerMode = policy?.centerMode ?? "always";
  const penMode = policy?.penMode ?? "bbox";
  const penStride = policy?.penStride ?? 1;
  const includePenLast = policy?.includePenLast ?? true;
  const highlighterMode = policy?.highlighterMode ?? "shape";

  if (stroke.tool === Tool.Pen) {
    if (penMode === "path") {
      return decimatePenPoints(stroke.points, penStride, includePenLast);
    }

    const bounds = getStrokeAABB(stroke);
    return buildBoxAnchors(bounds, stroke, centerMode);
  }

  if (stroke.tool === Tool.Highlighter && highlighterMode === "box") {
    const bounds = getStrokeAABB(stroke);
    return buildBoxAnchors(bounds, stroke, centerMode);
  }

  if (
    stroke.tool === Tool.Line ||
    stroke.tool === Tool.Arrow ||
    stroke.tool === Tool.Highlighter
  ) {
    const [start, end] = getStrokeEndpoints(stroke);
    return [
      { ...start, kind: "lineEnd" },
      { ...end, kind: "lineEnd" },
      {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
        pressure: 0.5,
        kind: "lineMid",
      },
    ];
  }

  if (stroke.tool === Tool.Text || stroke.tool === Tool.Rectangle) {
    const bounds = getStrokeBounds(stroke);
    return buildBoxAnchors(bounds, stroke, centerMode);
  }

  if (stroke.tool === Tool.Diamond) {
    const bounds = getStrokeBounds(stroke);
    return buildDiamondAnchors(bounds, stroke, centerMode);
  }

  if (stroke.tool === Tool.Ellipse) {
    const bounds = getStrokeBounds(stroke);
    return buildEllipseAnchors(bounds, stroke, centerMode);
  }

  return [];
};
