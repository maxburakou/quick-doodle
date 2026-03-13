import { Tool } from "./drawingTypes";

export type ShapeBoxTool = Tool.Rectangle | Tool.Diamond | Tool.Ellipse;

const SHAPE_BOX_TOOL_SET: Record<ShapeBoxTool, true> = {
  [Tool.Rectangle]: true,
  [Tool.Diamond]: true,
  [Tool.Ellipse]: true,
};

export const isShapeBoxTool = (tool: Tool): tool is ShapeBoxTool =>
  Boolean(SHAPE_BOX_TOOL_SET[tool as ShapeBoxTool]);

export const isFillableShapeTool = isShapeBoxTool;
