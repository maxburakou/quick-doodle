import { isShapeBoxTool, StrokePoint, Tool, TransformHandle } from "@/types";
import { isLineLikeGeometryTool } from "../toolProfile";

const INVERTED_AXIS_CONSTRAINT_TOOLS = new Set<Tool>([Tool.Highlighter]);
const SIDE_RESIZE_HANDLES = new Set<TransformHandle>(["n", "s", "e", "w"]);
const CORNER_RESIZE_HANDLES = new Set<TransformHandle>(["nw", "ne", "sw", "se"]);
const VERTICAL_ONLY_AXIS_HANDLES = new Set<TransformHandle>(["e", "w"]);
const HORIZONTAL_ONLY_AXIS_HANDLES = new Set<TransformHandle>(["n", "s"]);
const isCornerHandle = (handle: TransformHandle) =>
  CORNER_RESIZE_HANDLES.has(handle);

export type SnapInteractionMode = "draw" | "select";
export type SnapAxis = "x" | "y";

interface AxisGuideLike {
  snappedAxes: SnapAxis[];
  guideX?: number;
  guideY?: number;
}

interface SnapPolicyInput {
  mode: SnapInteractionMode;
  tool: Tool;
  shiftKey: boolean;
  handle?: TransformHandle;
}

export interface SnapPolicyDecision {
  axisConstraintActive: boolean;
  snapDisabled: boolean;
}

export interface SelectResizeSceneSnapPolicy {
  includeAnchors: boolean;
  includeSegments: boolean;
  includeAxisCandidates: boolean;
}

export interface SelectResizeGuidePolicyResult {
  snappedPoint: StrokePoint;
  axisGuide: AxisGuideLike | null;
}

export const shouldApplyAxisConstraint = (tool: Tool, shiftKey: boolean) =>
  INVERTED_AXIS_CONSTRAINT_TOOLS.has(tool) ? !shiftKey : shiftKey;

export const resolveSnapInteractionPolicy = ({
  mode,
  tool,
  shiftKey,
  handle,
}: SnapPolicyInput): SnapPolicyDecision => {
  const axisConstraintActive = shouldApplyAxisConstraint(tool, shiftKey);

  if (mode === "draw") {
    const snapDisabled =
      (isShapeBoxTool(tool) && shiftKey) ||
      (isLineLikeGeometryTool(tool) && axisConstraintActive);
    return { axisConstraintActive, snapDisabled };
  }

  if (handle === undefined) {
    return { axisConstraintActive, snapDisabled: true };
  }

  const snapDisabled =
    handle === "rotate" ||
    (isLineLikeGeometryTool(tool) && shiftKey) ||
    (isCornerHandle(handle) &&
      (tool === Tool.Text || (isShapeBoxTool(tool) && shiftKey)));

  return { axisConstraintActive, snapDisabled };
};

export const shouldDisableDrawSnap = (tool: Tool, shiftKey: boolean) =>
  resolveSnapInteractionPolicy({
    mode: "draw",
    tool,
    shiftKey,
  }).snapDisabled;

export const shouldDisableResizeSnap = (
  tool: Tool,
  handle: TransformHandle,
  shiftKey: boolean
) => {
  return (
    isCornerHandle(handle) &&
    (tool === Tool.Text || (isShapeBoxTool(tool) && shiftKey))
  );
};

export const shouldDisableSelectSnap = (
  tool: Tool,
  handle: TransformHandle,
  shiftKey: boolean
) => {
  return resolveSnapInteractionPolicy({
    mode: "select",
    tool,
    handle,
    shiftKey,
  }).snapDisabled;
};

export const resolveSelectResizeSceneSnapPolicy = (
  handle: TransformHandle
): SelectResizeSceneSnapPolicy => {
  if (SIDE_RESIZE_HANDLES.has(handle)) {
    return {
      includeAnchors: false,
      includeSegments: false,
      includeAxisCandidates: true,
    };
  }

  if (CORNER_RESIZE_HANDLES.has(handle)) {
    return {
      includeAnchors: true,
      includeSegments: true,
      includeAxisCandidates: false,
    };
  }

  return {
    includeAnchors: true,
    includeSegments: true,
    includeAxisCandidates: true,
  };
};

export const applySelectResizeGuidePolicy = (
  handle: TransformHandle,
  rawPoint: StrokePoint,
  snappedPoint: StrokePoint,
  axisGuide: AxisGuideLike | null | undefined
): SelectResizeGuidePolicyResult => {
  if (!axisGuide) {
    return {
      snappedPoint,
      axisGuide: null,
    };
  }

  if (VERTICAL_ONLY_AXIS_HANDLES.has(handle)) {
    if (!axisGuide.snappedAxes.includes("x") || axisGuide.guideX === undefined) {
      return {
        snappedPoint: rawPoint,
        axisGuide: null,
      };
    }
    return {
      snappedPoint: {
        ...snappedPoint,
        x: snappedPoint.x,
        y: rawPoint.y,
      },
      axisGuide: {
        snappedAxes: ["x"],
        guideX: axisGuide.guideX,
      },
    };
  }

  if (HORIZONTAL_ONLY_AXIS_HANDLES.has(handle)) {
    if (!axisGuide.snappedAxes.includes("y") || axisGuide.guideY === undefined) {
      return {
        snappedPoint: rawPoint,
        axisGuide: null,
      };
    }
    return {
      snappedPoint: {
        ...snappedPoint,
        x: rawPoint.x,
        y: snappedPoint.y,
      },
      axisGuide: {
        snappedAxes: ["y"],
        guideY: axisGuide.guideY,
      },
    };
  }

  return {
    snappedPoint,
    axisGuide,
  };
};
