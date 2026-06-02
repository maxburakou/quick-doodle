import {
  getSnapSubjectFromStroke,
  isLineLikeSnapTool,
  isShapeBoxSnapTool,
  resolveNearestSegmentSnap,
  resolveNearestSnap,
  resolveSnapForInteraction,
  type SnapSubject,
  withStrokeEndpoints,
} from "@/store/useShapeEditorStore/helpers";
import {
  pickDrawDrivingAnchors,
  pickDrawStartDrivingAnchors,
} from "@/store/useShapeEditorStore/helpers/snap/selectors";
import { Stroke, StrokePoint } from "@/types";
import { SMART_ASSIST_CONFIG } from "./config";

interface SmartAssistSceneSnapContext {
  anchors: SnapSubject["anchors"];
  segments: SnapSubject["segments"];
  axisCandidates: SnapSubject["axisCandidates"];
}

interface SnapSmartAssistReplacementStrokesParams {
  present: Stroke[];
  sourceStrokeIds: string[];
  replacementStrokes: Stroke[];
}

interface SnapSmartAssistReplacementStrokesResult {
  replacementStrokes: Stroke[];
  changed: boolean;
}

interface LineGuide {
  ux: number;
  uy: number;
}

const EMPTY_CONTEXT: SmartAssistSceneSnapContext = {
  anchors: [],
  segments: [],
  axisCandidates: [],
};

const SMART_ASSIST_SNAP_DISTANCE_PX = SMART_ASSIST_CONFIG.snap.distancePx;
const SMART_ASSIST_AXIS_SNAP_DISTANCE_PX =
  SMART_ASSIST_CONFIG.snap.axisDistancePx;
const LINE_GUIDE_EPSILON_DEG = 0.1;
const LINE_GUIDES = [0, 45, 90, 135].map((angleDeg) => {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    ux: Math.cos(radians),
    uy: Math.sin(radians),
  };
});

const buildSmartAssistSceneSnapContext = (
  present: Stroke[],
  sourceStrokeIds: string[]
): SmartAssistSceneSnapContext => {
  const sourceIdSet = new Set(sourceStrokeIds);
  const context: SmartAssistSceneSnapContext = {
    anchors: [],
    segments: [],
    axisCandidates: [],
  };

  present.forEach((stroke) => {
    if (sourceIdSet.has(stroke.id)) return;

    const subject = getSnapSubjectFromStroke(stroke);
    context.anchors.push(...subject.anchors);
    context.segments.push(...subject.segments);
    context.axisCandidates.push(...subject.axisCandidates);
  });

  return context;
};

const translatePoint = (
  point: StrokePoint,
  delta: Pick<StrokePoint, "x" | "y">
): StrokePoint => ({
  ...point,
  x: point.x + delta.x,
  y: point.y + delta.y,
});

const isSamePoint = (a: StrokePoint, b: StrokePoint) =>
  Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;

const normalizeAngleDeltaDeg = (deltaDeg: number): number => {
  let normalized = deltaDeg;
  while (normalized > 180) normalized -= 360;
  while (normalized <= -180) normalized += 360;
  return normalized;
};

const getUndirectedAngleDeltaDeg = (
  angleDeg: number,
  guideAngleDeg: number
): number =>
  Math.min(
    Math.abs(normalizeAngleDeltaDeg(angleDeg - guideAngleDeg)),
    Math.abs(normalizeAngleDeltaDeg(angleDeg - guideAngleDeg - 180))
  );

const getPreservedLineGuide = (
  start: StrokePoint,
  end: StrokePoint
): LineGuide | null => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return null;

  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  let bestGuide: LineGuide | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  LINE_GUIDES.forEach((guide, index) => {
    const guideAngleDeg = index * 45;
    const delta = getUndirectedAngleDeltaDeg(angleDeg, guideAngleDeg);
    if (delta >= bestDelta) return;

    bestDelta = delta;
    bestGuide = guide;
  });

  return bestGuide && bestDelta <= LINE_GUIDE_EPSILON_DEG ? bestGuide : null;
};

const projectPointToLineGuide = (
  point: StrokePoint,
  start: StrokePoint,
  guide: LineGuide
): StrokePoint => {
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  const projection = dx * guide.ux + dy * guide.uy;

  return {
    ...point,
    x: start.x + guide.ux * projection,
    y: start.y + guide.uy * projection,
  };
};

const hasEndpointChange = (source: Stroke, next: Stroke) => {
  const sourceStart = source.points[0];
  const sourceEnd = source.points[source.points.length - 1];
  const nextStart = next.points[0];
  const nextEnd = next.points[next.points.length - 1];

  if (!sourceStart || !sourceEnd || !nextStart || !nextEnd) return false;
  return !isSamePoint(sourceStart, nextStart) || !isSamePoint(sourceEnd, nextEnd);
};

const snapLineStart = (
  point: StrokePoint,
  sceneContext: SmartAssistSceneSnapContext
): StrokePoint => {
  const pointSnap = resolveNearestSnap(
    point,
    sceneContext.anchors,
    SMART_ASSIST_SNAP_DISTANCE_PX
  );
  if (pointSnap) {
    return {
      ...point,
      x: pointSnap.snappedX,
      y: pointSnap.snappedY,
    };
  }

  const segmentSnap = resolveNearestSegmentSnap(
    point,
    sceneContext.segments,
    SMART_ASSIST_SNAP_DISTANCE_PX
  );
  if (!segmentSnap) return point;

  return {
    ...point,
    x: segmentSnap.snappedX,
    y: segmentSnap.snappedY,
  };
};

const snapLineLikeReplacementStroke = (
  stroke: Stroke,
  sceneContext: SmartAssistSceneSnapContext
): Stroke => {
  const start = stroke.points[0];
  const end = stroke.points[stroke.points.length - 1];
  if (!start || !end || stroke.points.length < 2) return stroke;

  const snappedStart = snapLineStart(start, sceneContext);
  const startDelta = {
    x: snappedStart.x - start.x,
    y: snappedStart.y - start.y,
  };
  const endPointer = translatePoint(end, startDelta);
  const preservedGuide = getPreservedLineGuide(snappedStart, endPointer);
  const endAnchorSnap = resolveNearestSnap(
    endPointer,
    sceneContext.anchors,
    SMART_ASSIST_SNAP_DISTANCE_PX
  );
  if (endAnchorSnap) {
    return withStrokeEndpoints(stroke, snappedStart, {
      ...endPointer,
      x: endAnchorSnap.snappedX,
      y: endAnchorSnap.snappedY,
    });
  }

  const endSnap = resolveSnapForInteraction({
    rawPointer: endPointer,
    sceneContext,
    drivingAnchorSelector: (draftSubject) =>
      pickDrawDrivingAnchors(draftSubject.stroke, draftSubject.anchors),
    buildDraftStroke: (nextEnd) =>
      withStrokeEndpoints(stroke, snappedStart, nextEnd),
    snapDistance: SMART_ASSIST_SNAP_DISTANCE_PX,
    axisSnapDistance: SMART_ASSIST_AXIS_SNAP_DISTANCE_PX,
  });
  const snappedEnd = preservedGuide
    ? projectPointToLineGuide(endSnap.snappedPointer, snappedStart, preservedGuide)
    : endSnap.snappedPointer;

  return withStrokeEndpoints(stroke, snappedStart, snappedEnd);
};

const snapShapeBoxReplacementStroke = (
  stroke: Stroke,
  sceneContext: SmartAssistSceneSnapContext
): Stroke => {
  const start = stroke.points[0];
  const end = stroke.points[stroke.points.length - 1];
  if (!start || !end || stroke.points.length < 2) return stroke;

  const axisOnlySceneContext = {
    anchors: EMPTY_CONTEXT.anchors,
    segments: EMPTY_CONTEXT.segments,
    axisCandidates: sceneContext.axisCandidates,
  };

  const startSnap = resolveSnapForInteraction({
    rawPointer: start,
    sceneContext: axisOnlySceneContext,
    drivingAnchorSelector: (draftSubject) =>
      pickDrawStartDrivingAnchors(draftSubject.stroke),
    buildDraftStroke: (nextStart) =>
      withStrokeEndpoints(stroke, nextStart, end),
    snapDistance: SMART_ASSIST_SNAP_DISTANCE_PX,
    axisSnapDistance: SMART_ASSIST_AXIS_SNAP_DISTANCE_PX,
  });

  const snappedStart = startSnap.axisGuide ? startSnap.snappedPointer : start;
  const startDelta = {
    x: snappedStart.x - start.x,
    y: snappedStart.y - start.y,
  };
  const endPointer = startSnap.axisGuide ? translatePoint(end, startDelta) : end;

  const endSnap = resolveSnapForInteraction({
    rawPointer: endPointer,
    sceneContext: axisOnlySceneContext,
    drivingAnchorSelector: (draftSubject) =>
      pickDrawDrivingAnchors(draftSubject.stroke, draftSubject.anchors),
    buildDraftStroke: (nextEnd) =>
      withStrokeEndpoints(stroke, snappedStart, nextEnd),
    snapDistance: SMART_ASSIST_SNAP_DISTANCE_PX,
    axisSnapDistance: SMART_ASSIST_AXIS_SNAP_DISTANCE_PX,
  });

  return withStrokeEndpoints(stroke, snappedStart, endSnap.snappedPointer);
};

const snapReplacementStroke = (
  stroke: Stroke,
  sceneContext: SmartAssistSceneSnapContext
): Stroke => {
  if (isLineLikeSnapTool(stroke.tool)) {
    return snapLineLikeReplacementStroke(stroke, sceneContext);
  }

  if (isShapeBoxSnapTool(stroke.tool)) {
    return snapShapeBoxReplacementStroke(stroke, sceneContext);
  }

  return stroke;
};

export const snapSmartAssistReplacementStrokes = ({
  present,
  sourceStrokeIds,
  replacementStrokes,
}: SnapSmartAssistReplacementStrokesParams): SnapSmartAssistReplacementStrokesResult => {
  if (replacementStrokes.length === 0) {
    return { replacementStrokes, changed: false };
  }

  const sceneContext = buildSmartAssistSceneSnapContext(present, sourceStrokeIds);
  const snappedReplacementStrokes = replacementStrokes.map((stroke) =>
    snapReplacementStroke(stroke, sceneContext)
  );

  return {
    replacementStrokes: snappedReplacementStrokes,
    changed: replacementStrokes.some((stroke, index) =>
      hasEndpointChange(stroke, snappedReplacementStrokes[index])
    ),
  };
};
