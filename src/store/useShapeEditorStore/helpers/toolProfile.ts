import { Tool } from "@/types";
export type ToolGeometryMode = "lineLike" | "boxLike";

export interface ToolProfile {
  geometryMode: ToolGeometryMode;
}

const buildProfile = (geometryMode: ToolGeometryMode): ToolProfile => ({
  geometryMode,
});

const TOOL_PROFILES: Record<Tool, ToolProfile> = {
  [Tool.Select]: buildProfile("boxLike"),
  [Tool.Pen]: buildProfile("boxLike"),
  [Tool.Highlighter]: buildProfile("lineLike"),
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
