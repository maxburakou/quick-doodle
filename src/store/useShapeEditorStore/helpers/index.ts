export {
  createStrokeId,
  isEditableShapeTool,
  getStrokeRotation,
  getStrokeEndpoints,
  normalizeBoundsFromPoints,
  getStrokeBounds,
  getStrokeTransformBounds,
  getStrokeAABB,
  getBoundsCenter,
  rotatePoint,
  inverseRotatePoint,
  distance,
  distanceToSegment,
  withStrokeEndpoints,
} from "./core";

export {
  getStrokeTransformHandles,
  getHandleAtPointer,
  type TransformHandleMode,
} from "./selection/handles";
export {
  hitTestStroke,
  strokeIntersectsMarquee,
  getTopMostStrokeAtPointer,
} from "./selection/facade";
export {
  isPointInActiveZone,
  doesActiveZoneIntersectRect,
} from "./selection/activeZone";
export {
  getStrokeAnchorPoints,
  type StrokeAnchorPoint,
  type StrokeAnchorPolicy,
} from "./geometry/anchors";
export {
  getToolProfile,
  isLineLikeGeometryTool,
  type ToolProfile,
  type ToolGeometryMode,
} from "./toolProfile";

export {
  applySessionTransform,
  replaceStrokeById,
  moveStrokeIdsToEnd,
  buildPreviewStrokes,
  hasStrokeTransformChanged,
  hasGroupMoveChanged,
} from "./transform";

export {
  shouldApplyAxisConstraint,
  type AxisSnapLine,
  type AxisSnapResult,
  type SnapComputation,
  type SnapSubject,
  type InteractionSnapInput,
  type InteractionSnapResult,
  type MovingAnchorsSnapInput,
  type SnapSegment,
  isLineLikeSnapTool,
  isShapeBoxSnapTool,
  getConstrainedShapeEndpoint,
  getStrokeSnapAnchors,
  getSceneSnapAnchors,
  getSnapSubjectFromStroke,
  getStrokeSnapSegments,
  getSceneSnapSegments,
  getStrokeAxisSnapCandidates,
  getSceneAxisSnapCandidates,
  shouldDisableDrawSnap,
  shouldDisableSelectSnap,
  shouldDisableResizeSnap,
  getGroupBoundsAnchors,
  pickDiamondCornerAnchors,
  pickEllipseCardinalAnchors,
  pickLineLikeEndpointAnchors,
  pickRectangleCornerAnchors,
  pickResizeDrivingAnchors,
  resolveNearestSnap,
  resolveNearestSegmentSnap,
  resolveNearestAxisSnap,
  resolveSnapForMovingAnchors,
  resolveSnapForInteraction,
} from "./snap";
