import { isShapeBoxTool, Tool, TransformHandle } from "@/types";
import { isLineLikeGeometryTool } from "../toolProfile";

const isCornerHandle = (handle: TransformHandle) =>
  handle === "nw" || handle === "ne" || handle === "sw" || handle === "se";

const INVERTED_AXIS_CONSTRAINT_TOOLS = new Set<Tool>([Tool.Highlighter]);

export const shouldApplyAxisConstraint = (tool: Tool, shiftKey: boolean) =>
  INVERTED_AXIS_CONSTRAINT_TOOLS.has(tool) ? !shiftKey : shiftKey;

export const shouldDisableDrawSnap = (tool: Tool, shiftKey: boolean) => {
  if (isShapeBoxTool(tool) && shiftKey) return true;
  if (isLineLikeGeometryTool(tool) && shouldApplyAxisConstraint(tool, shiftKey)) return true;
  return false;
};

export const shouldDisableResizeSnap = (
  tool: Tool,
  handle: TransformHandle,
  shiftKey: boolean
) => {
  if (!isCornerHandle(handle)) return false;
  if (tool === Tool.Text) return true;
  if (isShapeBoxTool(tool) && shiftKey) return true;
  return false;
};

export const shouldDisableSelectSnap = (
  tool: Tool,
  handle: TransformHandle,
  shiftKey: boolean
) => {
  if (handle === "rotate") return true;
  if (isLineLikeGeometryTool(tool) && shiftKey) return true;
  return shouldDisableResizeSnap(tool, handle, shiftKey);
};
