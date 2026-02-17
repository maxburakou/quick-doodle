import { Stroke, StrokePoint, Tool, TransformHandle } from "@/types";
import { CSSProperties } from "react";
import {
  getHandleAtPointer,
  getTopMostStrokeAtPointer,
  hitTestStroke,
} from "@/store/useShapeEditorStore/helpers";
import { constrainLineToAxis, constrainToSquareBounds } from "../utils";

export type SelectCursor = CSSProperties["cursor"];

export interface SelectTargetResult {
  selectedStroke: Stroke | null;
  nextHandle: TransformHandle | null;
}

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
  selectedStroke: Stroke | null
): SelectCursor => {
  if (selectedStroke) {
    const selectedHandle = getHandleAtPointer(selectedStroke, pointer);
    if (selectedHandle) return getCursorByHandle(selectedHandle);
    if (hitTestStroke(selectedStroke, pointer)) return "grab";
  }

  const targetStroke = getTopMostStrokeAtPointer(present, pointer);
  if (!targetStroke) return "move";

  const targetHandle = getHandleAtPointer(targetStroke, pointer);
  if (targetHandle) return getCursorByHandle(targetHandle);
  return "grab";
};

export const resolveSelectTarget = (
  pointer: StrokePoint,
  present: Stroke[],
  selectedStroke: Stroke | null
): SelectTargetResult => {
  if (selectedStroke) {
    const handle = getHandleAtPointer(selectedStroke, pointer);

    if (handle) {
      return {
        selectedStroke,
        nextHandle: handle,
      };
    }

    if (hitTestStroke(selectedStroke, pointer)) {
      return {
        selectedStroke,
        nextHandle: "move",
      };
    }
  }

  const targetStroke = getTopMostStrokeAtPointer(present, pointer);
  if (!targetStroke) {
    return {
      selectedStroke: null,
      nextHandle: null,
    };
  }

  return {
    selectedStroke: targetStroke,
    nextHandle: getHandleAtPointer(targetStroke, pointer) ?? "move",
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
