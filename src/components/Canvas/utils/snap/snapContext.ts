import type { MutableRefObject } from "react";
import { Stroke } from "@/types";
import {
  getSceneAxisSnapCandidates,
  getSceneSnapAnchors,
  getSceneSnapSegments,
} from "@/store/useShapeEditorStore/helpers";

export interface CanvasBounds {
  width: number;
  height: number;
}

export interface SceneSnapContext {
  anchors: ReturnType<typeof getSceneSnapAnchors>;
  segments: ReturnType<typeof getSceneSnapSegments>;
  axisCandidates: ReturnType<typeof getSceneAxisSnapCandidates>;
}

export interface SceneSnapContextCache {
  presentRef: Stroke[];
  excludedIdsKey: string;
  canvasWidth: number;
  canvasHeight: number;
  context: SceneSnapContext;
}

const toExcludedIdsKey = (excludedIds: string[]) =>
  excludedIds.length <= 1
    ? (excludedIds[0] ?? "")
    : [...excludedIds].sort().join("|");

export const buildSceneSnapContext = (
  present: Stroke[],
  excludedIds: string[],
  canvasBounds: CanvasBounds
): SceneSnapContext => {
  const excludedSet = new Set(excludedIds);

  return {
    anchors: getSceneSnapAnchors(present, excludedSet, canvasBounds),
    segments: getSceneSnapSegments(present, excludedSet, canvasBounds),
    axisCandidates: getSceneAxisSnapCandidates(present, excludedSet, canvasBounds),
  };
};

export const getCachedSceneSnapContext = (
  cacheRef: MutableRefObject<SceneSnapContextCache | null>,
  present: Stroke[],
  excludedIds: string[],
  canvasBounds: CanvasBounds
): SceneSnapContext => {
  const excludedIdsKey = toExcludedIdsKey(excludedIds);
  const cached = cacheRef.current;

  if (
    cached &&
    cached.presentRef === present &&
    cached.excludedIdsKey === excludedIdsKey &&
    cached.canvasWidth === canvasBounds.width &&
    cached.canvasHeight === canvasBounds.height
  ) {
    return cached.context;
  }

  const context = buildSceneSnapContext(present, excludedIds, canvasBounds);
  cacheRef.current = {
    presentRef: present,
    excludedIdsKey,
    canvasWidth: canvasBounds.width,
    canvasHeight: canvasBounds.height,
    context,
  };

  return context;
};
