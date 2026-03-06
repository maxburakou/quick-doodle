export {
  createStrokeId,
  isEditableShapeTool,
  getStrokeRotation,
  getStrokeEndpoints,
  normalizeBoundsFromPoints,
  getStrokeBounds,
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
  hitTestStroke,
  strokeIntersectsMarquee,
  getTopMostStrokeAtPointer,
} from "./selection";
export {
  isPointInActiveZone,
  doesActiveZoneIntersectRect,
} from "./selection/activeZone";
export {
  getStrokeAnchorPoints,
  type StrokeAnchorPoint,
  type StrokeAnchorPolicy,
} from "./geometryAnchors";

export {
  applySessionTransform,
  replaceStrokeById,
  moveStrokeIdsToEnd,
  buildPreviewStrokes,
  hasStrokeTransformChanged,
  hasGroupMoveChanged,
} from "./transform";

export {
  type AxisSnapLine,
  type AxisSnapResult,
  type SnapComputation,
  isLineLikeSnapTool,
  isShapeBoxSnapTool,
  getStrokeSnapAnchors,
  getSceneSnapAnchors,
  getStrokeAxisSnapCandidates,
  getSceneAxisSnapCandidates,
  resolveNearestSnap,
  resolveNearestAxisSnap,
  resolveMoveSnapPointer,
  resolveLineEndpointSnap,
  resolveShapeCreateEndpointSnap,
} from "./snap";
