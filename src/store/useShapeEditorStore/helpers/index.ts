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
  isUnfilledClosedShape,
  isInteriorHitForClosedShape,
  getTopMostStrokeAtPointer,
} from "./selection";

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
