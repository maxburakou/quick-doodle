import { DEFAULT_FONT_SIZE } from "@/config";
import {
  getTextBounds,
  measureTextBox,
  normalizeTextStroke,
  getVisualStrokeBounds,
} from "@/components/Canvas/utils";
import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import {
  getSnapSubjectFromStroke,
  resolveSnapForMovingAnchors,
} from "@/store/useShapeEditorStore/helpers";
import { ShapeBounds, Stroke, StrokePoint, TextElement, Tool } from "@/types";
import { SMART_ASSIST_CONFIG } from "./config";
import { getStrokesBBox } from "./utils";

const FONT_SIZE_PROBE = 40;
const MIN_FONT_SIZE = Math.max(10, Math.min(...DEFAULT_FONT_SIZE) * 0.75);
const MAX_FONT_SIZE = Math.max(1024, Math.max(...DEFAULT_FONT_SIZE) * 16);
const FONT_SIZE_STEP = DEFAULT_FONT_SIZE.reduce((step, fontSize, index) => {
  if (index === 0) return step;

  const previous = DEFAULT_FONT_SIZE[index - 1];
  const diff = previous === undefined ? 0 : fontSize - previous;
  if (diff <= 0) return step;

  return step === null ? diff : Math.min(step, diff);
}, null as number | null) ?? 1;
const TEXT_WIDTH_PADDING_RATIO = 0.88;
const TEXT_HEIGHT_FONT_CAP_RATIO = 0.92;
const EXISTING_TEXT_JOIN_PADDING_RATIO = 0.55;
const EXISTING_TEXT_JOIN_MIN_PADDING_PX = 12;
const EXISTING_TEXT_JOIN_MAX_PADDING_PX = 24;
const HANDWRITING_BODY_BOTTOM_QUANTILE = 0.82;
const HANDWRITING_BODY_BOTTOM_PADDING_RATIO = 0.06;
const SMART_ASSIST_TEXT_SNAP_DISTANCE_PX = SMART_ASSIST_CONFIG.snap.distancePx;
const SMART_ASSIST_TEXT_AXIS_SNAP_DISTANCE_PX =
  SMART_ASSIST_CONFIG.snap.axisDistancePx;
const TEXT_CENTER_SNAP_DISTANCE_RATIO = 0.82;
const TEXT_TOP_SNAP_DISTANCE_RATIO = 0.66;

interface BBoxBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface TextPlacement {
  x: number;
  y: number;
  fontSize: number;
  metrics: ReturnType<typeof measureTextBox>;
  reasons: string[];
}

interface ExistingTextJoin {
  stroke: Stroke;
  separator: string;
  score: number;
}

interface TextSnapAnchorPass {
  reason: string;
  anchors: Array<Pick<StrokePoint, "x" | "y">>;
  snapDistance: number;
  axisSnapDistance: number;
}

export interface TextReplacementAction {
  sourceIds: string[];
  replacementStrokes: Stroke[];
  replacementStroke: Stroke;
  mode: "create" | "append";
  appendTargetId?: string;
  placementReasons: string[];
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const bboxToBounds = (bbox: BBoxBounds): ShapeBounds => ({
  x: bbox.minX,
  y: bbox.minY,
  width: Math.max(1, bbox.maxX - bbox.minX),
  height: Math.max(1, bbox.maxY - bbox.minY),
});

const getStrokePoints = (strokes: Stroke[]): StrokePoint[] =>
  strokes.flatMap((stroke) => stroke.points);

const getBoundsCenter = (bounds: ShapeBounds) => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2,
});

const inflateBounds = (bounds: ShapeBounds, padding: number): ShapeBounds => ({
  x: bounds.x - padding,
  y: bounds.y - padding,
  width: bounds.width + padding * 2,
  height: bounds.height + padding * 2,
});

const getBoundsRight = (bounds: ShapeBounds) => bounds.x + bounds.width;
const getBoundsBottom = (bounds: ShapeBounds) => bounds.y + bounds.height;

const getOverlap = (left: ShapeBounds, right: ShapeBounds) => {
  const width = Math.max(
    0,
    Math.min(getBoundsRight(left), getBoundsRight(right)) -
      Math.max(left.x, right.x)
  );
  const height = Math.max(
    0,
    Math.min(getBoundsBottom(left), getBoundsBottom(right)) -
      Math.max(left.y, right.y)
  );

  return {
    width,
    height,
    area: width * height,
  };
};

const measureAtFontSize = (value: string, fontSize: number) =>
  measureTextBox(value, Math.round(fontSize));

const getQuantile = (values: number[], quantile: number) => {
  if (values.length === 0) return null;

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * quantile))
  );
  return sorted[index] ?? null;
};

const getHandwritingBodyBounds = (
  sourceStrokes: Stroke[],
  sourceBounds: ShapeBounds
): ShapeBounds => {
  const points = getStrokePoints(sourceStrokes);
  if (points.length < 4) return sourceBounds;

  const quantileBottom = getQuantile(
    points.map((point) => point.y),
    HANDWRITING_BODY_BOTTOM_QUANTILE
  );
  if (quantileBottom === null) return sourceBounds;

  const padding = sourceBounds.height * HANDWRITING_BODY_BOTTOM_PADDING_RATIO;
  const bodyBottom = clamp(
    quantileBottom + padding,
    sourceBounds.y + sourceBounds.height * 0.55,
    getBoundsBottom(sourceBounds)
  );

  return {
    ...sourceBounds,
    height: Math.max(1, bodyBottom - sourceBounds.y),
  };
};

const fitFontSizeToWidth = (
  value: string,
  targetWidth: number,
  maxFontSize: number = MAX_FONT_SIZE
) => {
  const probeMetrics = measureTextBox(value, FONT_SIZE_PROBE);
  const widthRatio = targetWidth / Math.max(1, probeMetrics.width);
  return clamp(FONT_SIZE_PROBE * widthRatio, MIN_FONT_SIZE, maxFontSize);
};

const quantizeFontSizeToTextStep = (fontSize: number) => {
  const baseFontSize = DEFAULT_FONT_SIZE[0] ?? MIN_FONT_SIZE;
  const steppedFontSize =
    baseFontSize + Math.round((fontSize - baseFontSize) / FONT_SIZE_STEP) * FONT_SIZE_STEP;

  return clamp(steppedFontSize, MIN_FONT_SIZE, MAX_FONT_SIZE);
};

const pickFontSizeForSourceBounds = (value: string, sourceBounds: ShapeBounds) => {
  const targetWidth = Math.max(1, sourceBounds.width * TEXT_WIDTH_PADDING_RATIO);
  const widthDrivenFontSize = fitFontSizeToWidth(value, targetWidth);
  const heightCap = sourceBounds.height * TEXT_HEIGHT_FONT_CAP_RATIO;

  return quantizeFontSizeToTextStep(clamp(
    Math.min(widthDrivenFontSize, heightCap),
    MIN_FONT_SIZE,
    MAX_FONT_SIZE
  ));
};

const getBaseTextPlacement = (
  sourceBounds: ShapeBounds,
  value: string
): TextPlacement => {
  const sourceCenter = getBoundsCenter(sourceBounds);
  const fontSize = pickFontSizeForSourceBounds(value, sourceBounds);
  const metrics = measureAtFontSize(value, fontSize);

  return {
    x: sourceCenter.x - metrics.width / 2,
    y: getBoundsBottom(sourceBounds) - metrics.height,
    fontSize: Math.round(fontSize),
    metrics,
    reasons: ["source-center", "source-bottom"],
  };
};

const isBoundsInsideBounds = (inner: ShapeBounds, outer: ShapeBounds, padding = 0) =>
  inner.x >= outer.x - padding &&
  inner.y >= outer.y - padding &&
  getBoundsRight(inner) <= getBoundsRight(outer) + padding &&
  getBoundsBottom(inner) <= getBoundsBottom(outer) + padding;

const isTextInsideCenterSnapShape = (
  textStroke: Stroke,
  present: Stroke[],
  sourceIds: Set<string>
) => {
  const textBounds = getTextBounds(textStroke);
  const textCenter = getBoundsCenter(textBounds);

  return present.some((stroke) => {
    if (sourceIds.has(stroke.id)) return false;
    if (
      stroke.tool !== Tool.Rectangle &&
      stroke.tool !== Tool.Ellipse &&
      stroke.tool !== Tool.Diamond
    ) {
      return false;
    }

    const shapeBounds = getVisualStrokeBounds(stroke);
    const padding = Math.max(8, Math.min(shapeBounds.width, shapeBounds.height) * 0.04);
    const overlap = getOverlap(textBounds, shapeBounds);
    const overlapRatio =
      overlap.area / Math.max(1, textBounds.width * textBounds.height);

    return (
      textCenter.x >= shapeBounds.x - padding &&
      textCenter.x <= getBoundsRight(shapeBounds) + padding &&
      textCenter.y >= shapeBounds.y - padding &&
      textCenter.y <= getBoundsBottom(shapeBounds) + padding &&
      isBoundsInsideBounds(textBounds, shapeBounds, padding) &&
      overlapRatio >= 0.75
    );
  });
};

const getTextSnapAnchorPasses = (
  stroke: Stroke,
  preferCenter: boolean
): TextSnapAnchorPass[] => {
  const bounds = getTextBounds(stroke);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;

  const bottomPass = {
    reason: "scene-bottom-snap",
    anchors: [
      { x: bounds.x, y: bottom },
      { x: centerX, y: bottom },
      { x: right, y: bottom },
    ],
    snapDistance: SMART_ASSIST_TEXT_SNAP_DISTANCE_PX,
    axisSnapDistance: SMART_ASSIST_TEXT_AXIS_SNAP_DISTANCE_PX,
  };
  const centerPass = {
    reason: "scene-center-snap",
    anchors: [
      { x: bounds.x, y: centerY },
      { x: centerX, y: centerY },
      { x: right, y: centerY },
    ],
    snapDistance:
      SMART_ASSIST_TEXT_SNAP_DISTANCE_PX * TEXT_CENTER_SNAP_DISTANCE_RATIO,
    axisSnapDistance:
      SMART_ASSIST_TEXT_AXIS_SNAP_DISTANCE_PX * TEXT_CENTER_SNAP_DISTANCE_RATIO,
  };
  const topPass = {
    reason: "scene-top-snap",
    anchors: [
      { x: bounds.x, y: bounds.y },
      { x: centerX, y: bounds.y },
      { x: right, y: bounds.y },
    ],
    snapDistance: SMART_ASSIST_TEXT_SNAP_DISTANCE_PX * TEXT_TOP_SNAP_DISTANCE_RATIO,
    axisSnapDistance:
      SMART_ASSIST_TEXT_AXIS_SNAP_DISTANCE_PX * TEXT_TOP_SNAP_DISTANCE_RATIO,
  };

  return preferCenter
    ? [centerPass, bottomPass, topPass]
    : [bottomPass, centerPass, topPass];
};

const applySceneSnapToTextPlacement = (
  placement: TextPlacement,
  replacementStroke: Stroke,
  present: Stroke[],
  sourceIds: Set<string>
): TextPlacement => {
  const anchorPasses = getTextSnapAnchorPasses(
    replacementStroke,
    isTextInsideCenterSnapShape(replacementStroke, present, sourceIds)
  );
  if (anchorPasses.every((pass) => pass.anchors.length === 0)) return placement;

  const sceneContext = present.reduce<{
    anchors: ReturnType<typeof getSnapSubjectFromStroke>["anchors"];
    segments: ReturnType<typeof getSnapSubjectFromStroke>["segments"];
    axisCandidates: ReturnType<typeof getSnapSubjectFromStroke>["axisCandidates"];
  }>(
    (context, stroke) => {
      if (sourceIds.has(stroke.id)) return context;

      const subject = getSnapSubjectFromStroke(stroke);
      context.anchors.push(...subject.anchors);
      context.segments.push(...subject.segments);
      context.axisCandidates.push(...subject.axisCandidates);
      return context;
    },
    {
      anchors: [],
      segments: [],
      axisCandidates: [],
    }
  );

  if (
    sceneContext.anchors.length === 0 &&
    sceneContext.segments.length === 0 &&
    sceneContext.axisCandidates.length === 0
  ) {
    return placement;
  }

  const startPoint = replacementStroke.points[0];
  if (!startPoint) return placement;

  for (const pass of anchorPasses) {
    const snap = resolveSnapForMovingAnchors({
      rawPointer: startPoint,
      startPointer: startPoint,
      movingAnchors: pass.anchors,
      sceneContext,
      snapDistance: pass.snapDistance,
      axisSnapDistance: pass.axisSnapDistance,
    });

    const deltaX = snap.point.x - startPoint.x;
    const deltaY = snap.point.y - startPoint.y;
    if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
      continue;
    }

    return {
      ...placement,
      x: placement.x + deltaX,
      y: placement.y + deltaY,
      reasons: [
        ...placement.reasons,
        pass.reason,
        ...(snap.pointTarget ? ["scene-anchor-or-segment-snap"] : []),
        ...(snap.axisSnap ? ["scene-axis-snap"] : []),
      ],
    };
  }

  return placement;
};

const getTextJoinSeparator = (
  sourceBounds: ShapeBounds,
  targetBounds: ShapeBounds,
  targetValue: string
) => {
  const sourceCenter = getBoundsCenter(sourceBounds);
  const targetCenter = getBoundsCenter(targetBounds);
  const xOverlapRatio =
    getOverlap(sourceBounds, targetBounds).width /
    Math.max(1, Math.min(sourceBounds.width, targetBounds.width));
  const isBelow =
    sourceCenter.y > targetCenter.y &&
    sourceBounds.y >= targetBounds.y + targetBounds.height * 0.45 &&
    xOverlapRatio > 0.25;

  if (isBelow) return "\n";
  if (/\s$/.test(targetValue)) return "";
  return " ";
};

const findExistingTextJoin = (
  present: Stroke[],
  sourceIds: Set<string>,
  sourceBounds: ShapeBounds
): ExistingTextJoin | null => {
  const sourceCenter = getBoundsCenter(sourceBounds);

  return present
    .filter(
      (stroke) =>
        !sourceIds.has(stroke.id) &&
        stroke.tool === Tool.Text &&
        stroke.text &&
        Math.abs(stroke.rotation ?? 0) < 0.001
    )
    .map((stroke) => {
      const targetBounds = getTextBounds(stroke);
      const targetCenter = getBoundsCenter(targetBounds);
      const padding = clamp(
        stroke.text!.fontSize * EXISTING_TEXT_JOIN_PADDING_RATIO,
        EXISTING_TEXT_JOIN_MIN_PADDING_PX,
        EXISTING_TEXT_JOIN_MAX_PADDING_PX
      );
      const expandedTarget = inflateBounds(targetBounds, padding);
      const expandedOverlap = getOverlap(sourceBounds, expandedTarget);
      if (expandedOverlap.area <= 0) return null;

      const overlap = getOverlap(sourceBounds, targetBounds);
      const xOverlapRatio =
        overlap.width /
        Math.max(1, Math.min(sourceBounds.width, targetBounds.width));
      const yOverlapRatio =
        overlap.height /
        Math.max(1, Math.min(sourceBounds.height, targetBounds.height));
      const horizontalGap = Math.max(
        0,
        Math.max(targetBounds.x - getBoundsRight(sourceBounds), sourceBounds.x - getBoundsRight(targetBounds))
      );
      const verticalGap = Math.max(
        0,
        Math.max(targetBounds.y - getBoundsBottom(sourceBounds), sourceBounds.y - getBoundsBottom(targetBounds))
      );
      const continuesRight =
        sourceCenter.x >= targetCenter.x &&
        sourceBounds.x >= targetBounds.x + targetBounds.width * 0.6 &&
        horizontalGap <= padding &&
        (yOverlapRatio > 0.38 ||
          Math.abs(sourceCenter.y - targetCenter.y) <= padding * 0.55);
      const continuesBelow =
        sourceCenter.y >= targetCenter.y &&
        sourceBounds.y >= targetBounds.y + targetBounds.height * 0.72 &&
        verticalGap <= padding &&
        xOverlapRatio > 0.35;

      if (!continuesRight && !continuesBelow) {
        return null;
      }

      return {
        stroke,
        separator: getTextJoinSeparator(sourceBounds, targetBounds, stroke.text!.value),
        score: horizontalGap + verticalGap + Math.abs(sourceCenter.y - targetCenter.y) * 0.35,
      };
    })
    .filter((candidate): candidate is ExistingTextJoin => candidate !== null)
    .sort((left, right) => left.score - right.score)[0] ?? null;
};

const buildUpdatedJoinedTextStroke = (
  target: Stroke,
  value: string,
  separator: string
): Stroke | null => {
  if (!target.text) return null;

  const normalized = normalizeTextStroke(target);
  const start = normalized.points[0] ?? target.points[0];
  if (!start) return null;

  const nextValue = `${target.text.value}${separator}${value}`;
  const metrics = measureTextBox(nextValue, target.text.fontSize);
  const end: StrokePoint = {
    x: start.x + metrics.width,
    y: start.y + metrics.height,
    pressure: normalized.points[1]?.pressure ?? start.pressure ?? 0.5,
    t: target.points[1]?.t,
  };

  return {
    ...normalized,
    points: [
      {
        ...start,
        t: target.points[0]?.t,
      },
      end,
    ],
    thickness: target.text.fontSize,
    text: {
      ...target.text,
      value: nextValue,
      width: metrics.width,
      height: metrics.height,
    },
  };
};

const buildPlacedTextStroke = (
  sourceStrokes: Stroke[],
  value: string,
  placement: TextPlacement
): Stroke | null => {
  const baseStroke = sourceStrokes[0];
  if (!baseStroke) return null;

  const firstPoint = baseStroke.points[0];
  const lastPoint = baseStroke.points[baseStroke.points.length - 1] ?? firstPoint;
  const text: TextElement = {
    value,
    fontSize: placement.fontSize,
    width: placement.metrics.width,
    height: placement.metrics.height,
  };

  return {
    id: createStrokeId(),
    points: [
      {
        x: placement.x,
        y: placement.y,
        pressure: firstPoint?.pressure ?? 0.5,
        t: firstPoint?.t,
      },
      {
        x: placement.x + placement.metrics.width,
        y: placement.y + placement.metrics.height,
        pressure: lastPoint?.pressure ?? firstPoint?.pressure ?? 0.5,
        t: lastPoint?.t,
      },
    ],
    color: baseStroke.color,
    thickness: placement.fontSize,
    tool: Tool.Text,
    text,
    rotation: 0,
  };
};

export const buildTextReplacementAction = ({
  sourceStrokes,
  sourceIds,
  value,
  present,
}: {
  sourceStrokes: Stroke[];
  sourceIds: string[];
  value: string;
  present: Stroke[];
}): TextReplacementAction | null => {
  const bbox = getStrokesBBox(sourceStrokes);
  if (!bbox || sourceStrokes.length === 0) return null;

  const sourceBounds = bboxToBounds(bbox);
  const bodyBounds = getHandwritingBodyBounds(sourceStrokes, sourceBounds);
  const sourceIdSet = new Set(sourceIds);
  const join = findExistingTextJoin(present, sourceIdSet, bodyBounds);
  if (join) {
    const joinedStroke = buildUpdatedJoinedTextStroke(
      join.stroke,
      value,
      join.separator
    );
    if (joinedStroke) {
      return {
        sourceIds: [...sourceIds, join.stroke.id],
        replacementStrokes: [joinedStroke],
        replacementStroke: joinedStroke,
        mode: "append",
        appendTargetId: join.stroke.id,
        placementReasons: [
          join.separator === "\n" ? "existing-text-new-line" : "existing-text-inline",
        ],
      };
    }
  }

  const basePlacement = getBaseTextPlacement(bodyBounds, value);
  const initialReplacementStroke = buildPlacedTextStroke(
    sourceStrokes,
    value,
    basePlacement
  );
  if (!initialReplacementStroke) return null;
  const snappedPlacement = applySceneSnapToTextPlacement(
    basePlacement,
    initialReplacementStroke,
    present,
    sourceIdSet
  );
  const replacementStroke = buildPlacedTextStroke(
    sourceStrokes,
    value,
    snappedPlacement
  );
  if (!replacementStroke) return null;

  return {
    sourceIds,
    replacementStrokes: [replacementStroke],
    replacementStroke,
    mode: "create",
    placementReasons: snappedPlacement.reasons,
  };
};

export const buildTextReplacementStroke = (
  sourceStrokes: Stroke[],
  value: string
): Stroke | null => {
  return buildTextReplacementAction({
    sourceStrokes,
    sourceIds: sourceStrokes.map((stroke) => stroke.id),
    value,
    present: sourceStrokes,
  })?.replacementStroke ?? null;
};
