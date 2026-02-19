import { Stroke, StrokePoint, Tool, TransformHandle } from "@/types";
import { CSSProperties } from "react";
import {
  getHandleAtPointer,
  getStrokeAABB,
  getTopMostStrokeAtPointer,
  hitTestStroke,
} from "@/store/useShapeEditorStore/helpers";
import { constrainLineToAxis, constrainToSquareBounds } from "../utils";

export type SelectCursor = CSSProperties["cursor"];

export interface SelectTargetResult {
  targetStroke: Stroke | null;
  nextHandle: TransformHandle | null;
  isBodyHit: boolean;
  targetKind:
    | "none"
    | "single-selected"
    | "selected-group-member"
    | "unselected";
}

const isPointInsideBounds = (point: StrokePoint, stroke: Stroke) => {
  const bounds = getStrokeAABB(stroke);
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
};

const isPointInsideGroupBounds = (point: StrokePoint, strokes: Stroke[]) => {
  if (strokes.length === 0) return false;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  strokes.forEach((stroke) => {
    const bounds = getStrokeAABB(stroke);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });

  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
};

export const getCursorByHandle = (handle: TransformHandle): SelectCursor => {
  if (handle === "move") return "grab";
  if (handle === "rotate") return "alias";
  if (handle === "n" || handle === "s") return "ns-resize";
  if (handle === "e" || handle === "w") return "ew-resize";
  if (handle === "nw" || handle === "se") return "nwse-resize";
  return "nesw-resize";
};

export const resolveSelectCursor = (
  pointer: StrokePoint,
  present: Stroke[],
  selectedStrokes: Stroke[],
  primarySelectedStroke: Stroke | null
): SelectCursor => {
  if (selectedStrokes.length === 1 && primarySelectedStroke) {
    const selectedHandle = getHandleAtPointer(primarySelectedStroke, pointer);
    if (selectedHandle) return getCursorByHandle(selectedHandle);
    if (hitTestStroke(primarySelectedStroke, pointer)) return "grab";
    if (isPointInsideBounds(pointer, primarySelectedStroke)) return "grab";
  }

  if (selectedStrokes.length > 1) {
    const selectedStrokeAtPointer = selectedStrokes
      .slice()
      .reverse()
      .find((stroke) => hitTestStroke(stroke, pointer));
    if (selectedStrokeAtPointer) return "grab";
    if (isPointInsideGroupBounds(pointer, selectedStrokes)) return "grab";
  }

  const targetStroke = getTopMostStrokeAtPointer(present, pointer);
  if (!targetStroke) return "move";

  const targetHandle =
    selectedStrokes.length <= 1 ? getHandleAtPointer(targetStroke, pointer) : null;
  if (targetHandle) return getCursorByHandle(targetHandle);
  return "grab";
};

export const resolveSelectTarget = (
  pointer: StrokePoint,
  present: Stroke[],
  selectedStrokes: Stroke[],
  primarySelectedStroke: Stroke | null
): SelectTargetResult => {
  if (selectedStrokes.length === 1 && primarySelectedStroke) {
    const handle = getHandleAtPointer(primarySelectedStroke, pointer);

    if (handle) {
      return {
        targetStroke: primarySelectedStroke,
        nextHandle: handle,
        isBodyHit: true,
        targetKind: "single-selected",
      };
    }

    if (hitTestStroke(primarySelectedStroke, pointer)) {
      return {
        targetStroke: primarySelectedStroke,
        nextHandle: "move",
        isBodyHit: true,
        targetKind: "single-selected",
      };
    }

    if (isPointInsideBounds(pointer, primarySelectedStroke)) {
      return {
        targetStroke: primarySelectedStroke,
        nextHandle: "move",
        isBodyHit: false,
        targetKind: "single-selected",
      };
    }
  }

  if (selectedStrokes.length > 1) {
    const targetSelectedStroke = selectedStrokes
      .slice()
      .reverse()
      .find((stroke) => hitTestStroke(stroke, pointer));

    if (targetSelectedStroke) {
      return {
        targetStroke: targetSelectedStroke,
        nextHandle: "move",
        isBodyHit: true,
        targetKind: "selected-group-member",
      };
    }

    if (isPointInsideGroupBounds(pointer, selectedStrokes)) {
      return {
        targetStroke: primarySelectedStroke ?? selectedStrokes[selectedStrokes.length - 1] ?? null,
        nextHandle: "move",
        isBodyHit: false,
        targetKind: "selected-group-member",
      };
    }
  }

  const targetStroke = getTopMostStrokeAtPointer(present, pointer);
  if (!targetStroke) {
    return {
      targetStroke: null,
      nextHandle: null,
      isBodyHit: false,
      targetKind: "none",
    };
  }

  return {
    targetStroke,
    nextHandle:
      (selectedStrokes.length <= 1 ? getHandleAtPointer(targetStroke, pointer) : null) ??
      "move",
    isBodyHit: true,
    targetKind: "unselected",
  };
};

export const finalizeStrokePoints = (
  points: StrokePoint[],
  strokeTool: Tool,
  isShiftPressed?: boolean
): StrokePoint[] => {
  if (points.length < 2) return points;

  const start = points[0];
  const end = points[points.length - 1];

  if (!isShiftPressed) {
    if (
      strokeTool === Tool.Line ||
      strokeTool === Tool.Arrow ||
      strokeTool === Tool.Highlighter ||
      strokeTool === Tool.Rectangle ||
      strokeTool === Tool.Ellipse ||
      strokeTool === Tool.Diamond
    ) {
      return [start, end];
    }
    return points;
  }

  if (
    strokeTool === Tool.Line ||
    strokeTool === Tool.Arrow ||
    strokeTool === Tool.Highlighter
  ) {
    return [start, constrainLineToAxis(start, end, 15)];
  }

  if (
    strokeTool === Tool.Rectangle ||
    strokeTool === Tool.Ellipse ||
    strokeTool === Tool.Diamond
  ) {
    return [start, constrainToSquareBounds(start, end)];
  }

  return points;
};
