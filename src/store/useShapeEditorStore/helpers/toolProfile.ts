import { Tool } from "@/types";
export type ToolGeometryMode = "lineLike" | "boxLike";
export type AxisConstraintMode = "normal" | "inverted";

export interface ToolProfile {
  geometryMode: ToolGeometryMode;
  axisConstraintMode: AxisConstraintMode;
}

const buildProfile = (
  geometryMode: ToolGeometryMode,
  axisConstraintMode: AxisConstraintMode = "normal"
): ToolProfile => ({
  geometryMode,
  axisConstraintMode,
});

const TOOL_PROFILES: Record<Tool, ToolProfile> = {
  [Tool.Select]: buildProfile("boxLike"),
  [Tool.Pen]: buildProfile("boxLike", "normal"),
  [Tool.Highlighter]: buildProfile("lineLike", "inverted"),
  [Tool.Text]: buildProfile("boxLike"),
  [Tool.Arrow]: buildProfile("lineLike"),
  [Tool.Line]: buildProfile("lineLike"),
  [Tool.Rectangle]: buildProfile("boxLike"),
  [Tool.Diamond]: buildProfile("boxLike"),
  [Tool.Ellipse]: buildProfile("boxLike"),
};

export const getToolProfile = (tool: Tool): ToolProfile =>
  TOOL_PROFILES[tool] ?? TOOL_PROFILES[Tool.Select];

export const isLineLikeGeometryTool = (tool: Tool) =>
  getToolProfile(tool).geometryMode === "lineLike";

export const getAxisConstrainedByShift = (tool: Tool, shiftKey: boolean) =>
  getToolProfile(tool).axisConstraintMode === "inverted" ? !shiftKey : shiftKey;
