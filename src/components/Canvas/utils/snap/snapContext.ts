import type { MutableRefObject } from "react";
import { Stroke, Tool } from "@/types";
import {
  getSnapSubjectFromStroke,
} from "@/store/useShapeEditorStore/helpers";

export interface CanvasBounds {
  width: number;
  height: number;
}

export interface SceneSnapContext {
  anchors: ReturnType<typeof getSnapSubjectFromStroke>["anchors"];
  segments: ReturnType<typeof getSnapSubjectFromStroke>["segments"];
  axisCandidates: ReturnType<typeof getSnapSubjectFromStroke>["axisCandidates"];
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
  const anchors: SceneSnapContext["anchors"] = [];
  const segments: SceneSnapContext["segments"] = [];
  const axisCandidates: SceneSnapContext["axisCandidates"] = [];

  present.forEach((stroke) => {
    if (excludedSet.has(stroke.id)) return;
    const subject = getSnapSubjectFromStroke(stroke);
    anchors.push(...subject.anchors);
    segments.push(...subject.segments);
    axisCandidates.push(...subject.axisCandidates);
  });

  const canvasSubject = getSnapSubjectFromStroke({
    id: "__canvas__",
    points: [
      { x: 0, y: 0, pressure: 0.5 },
      { x: canvasBounds.width, y: canvasBounds.height, pressure: 0.5 },
    ],
    color: "",
    thickness: 1,
    tool: Tool.Rectangle,
  });
  anchors.push(...canvasSubject.anchors);
  segments.push(...canvasSubject.segments);
  axisCandidates.push(...canvasSubject.axisCandidates);

  return {
    anchors,
    segments,
    axisCandidates,
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
