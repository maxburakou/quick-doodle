import { Tool } from "@/types";

export type ToolbarSettingControl = "color" | "stroke" | "textSize";

export interface ToolbarToolConfig {
  settings: ToolbarSettingControl[] | null;
}

export interface ToolbarToolMeta {
  tool: Tool;
  hotkey: string;
}
