import { ACTIVE_ZONE_PX } from "@/config/selectionConfig";
import { Tool } from "@/types";
import { getHighlighterStrokeWidth } from "@/utils/highlighter";

export type ToolGeometryMode = "lineLike" | "boxLike";
export type AxisConstraintMode = "normal" | "inverted";

export interface ToolProfile {
  geometryMode: ToolGeometryMode;
  axisConstraintMode: AxisConstraintMode;
  visualStrokeWidth: (thickness: number) => number;
  interactionRadius: (thickness: number) => number;
  aabbPadding: (thickness: number) => number;
}

const defaultStrokeWidth = (thickness: number) => Math.max(1, thickness);
const defaultInteractionRadius = () => ACTIVE_ZONE_PX;
const defaultAabbPadding = () => 0;

const buildProfile = (
  geometryMode: ToolGeometryMode,
  axisConstraintMode: AxisConstraintMode = "normal",
  visualStrokeWidth: (thickness: number) => number = defaultStrokeWidth,
  interactionRadius: (thickness: number) => number = defaultInteractionRadius,
  aabbPadding: (thickness: number) => number = defaultAabbPadding
): ToolProfile => ({
  geometryMode,
  axisConstraintMode,
  visualStrokeWidth,
  interactionRadius,
  aabbPadding,
});

const highlighterInteractionRadius = (thickness: number) =>
  Math.max(ACTIVE_ZONE_PX, getHighlighterStrokeWidth(thickness) / 2);

const TOOL_PROFILES: Record<Tool, ToolProfile> = {
  [Tool.Select]: buildProfile("boxLike"),
  [Tool.Pen]: buildProfile(
    "boxLike",
    "normal",
    defaultStrokeWidth,
    defaultInteractionRadius,
    (thickness) => thickness * 2
  ),
  [Tool.Highlighter]: buildProfile(
    "lineLike",
    "inverted",
    getHighlighterStrokeWidth,
    highlighterInteractionRadius,
    highlighterInteractionRadius
  ),
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
