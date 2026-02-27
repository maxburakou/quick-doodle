import { Tool } from "@/types";
import { ToolbarToolConfig, ToolbarToolMeta } from "./types";

export const TOOL_META: ToolbarToolMeta[] = [
  { tool: Tool.Pen, hotkeySlot: 1 },
  { tool: Tool.Highlighter, hotkeySlot: 2 },
  { tool: Tool.Arrow, hotkeySlot: 3 },
  { tool: Tool.Line, hotkeySlot: 4 },
  { tool: Tool.Rectangle, hotkeySlot: 5 },
  { tool: Tool.Diamond, hotkeySlot: 6 },
  { tool: Tool.Ellipse, hotkeySlot: 7 },
  { tool: Tool.Text, hotkeySlot: 8 },
  { tool: Tool.Select, hotkeySlot: 9 },
];

export const TOOL_CONFIG: Record<Tool, ToolbarToolConfig> = {
  [Tool.Pen]: {
    settings: ["color", "stroke"],
  },
  [Tool.Highlighter]: {
    settings: ["color", "stroke"],
  },
  [Tool.Arrow]: {
    settings: ["color", "stroke"],
  },
  [Tool.Line]: {
    settings: ["color", "stroke"],
  },
  [Tool.Rectangle]: {
    settings: ["color", "stroke"],
  },
  [Tool.Diamond]: {
    settings: ["color", "stroke"],
  },
  [Tool.Ellipse]: {
    settings: ["color", "stroke"],
  },
  [Tool.Text]: {
    settings: ["color", "textSize"],
  },
  [Tool.Select]: {
    settings: null,
  },
};
