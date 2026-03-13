import { ShapeBounds, Stroke, StrokePoint } from "@/types";
import {
  doesActiveZoneIntersectRect,
  isPointInActiveZone,
} from "./activeZone";

export const hitTestStroke = (stroke: Stroke, pointer: StrokePoint) => {
  return isPointInActiveZone(stroke, pointer);
};

export const strokeIntersectsMarquee = (stroke: Stroke, marqueeBounds: ShapeBounds) => {
  return doesActiveZoneIntersectRect(stroke, marqueeBounds);
};

export const getTopMostStrokeAtPointer = (
  strokes: Stroke[],
  pointer: StrokePoint
): Stroke | null => {
  for (let index = strokes.length - 1; index >= 0; index -= 1) {
    const stroke = strokes[index];
    if (!stroke) continue;
    if (hitTestStroke(stroke, pointer)) {
      return stroke;
    }
  }

  return null;
};
