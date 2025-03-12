import { Tool } from "../../types";

export interface ToolState {
  tool: Tool;
  setTool: (tool: Tool) => void;
}