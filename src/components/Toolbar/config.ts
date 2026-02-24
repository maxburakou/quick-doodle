import { Tool } from "@/types";
import { ToolbarToolConfig, ToolbarToolMeta } from "./types";

export const TOOL_META: ToolbarToolMeta[] = [
  { tool: Tool.Pen, hotkey: "1" },
  { tool: Tool.Highlighter, hotkey: "2" },
  { tool: Tool.Arrow, hotkey: "3" },
  { tool: Tool.Line, hotkey: "4" },
  { tool: Tool.Rectangle, hotkey: "5" },
  { tool: Tool.Diamond, hotkey: "6" },
  { tool: Tool.Ellipse, hotkey: "7" },
  { tool: Tool.Text, hotkey: "8" },
  { tool: Tool.Select, hotkey: "9" },
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
