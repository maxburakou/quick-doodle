import { Tool } from "@/types";
import { ReactNode } from "react";

type ValueOf<T> = T[keyof T];

export const TOOLBAR_SETTING_CONTROL = {
  COLOR: "color",
  STROKE: "stroke",
  TEXT_SIZE: "textSize",
} as const;

export type ToolbarSettingControl = ValueOf<typeof TOOLBAR_SETTING_CONTROL>;

export const TOOLBAR_SETTINGS_CONTEXT = {
  ACTIVE_TOOL: "active-tool",
  SINGLE_SELECTION: "single-selection",
  GROUP_SELECTION: "group-selection",
  NONE: "none",
} as const;

export type ToolbarSettingsContext = ValueOf<typeof TOOLBAR_SETTINGS_CONTEXT>;

export interface ToolbarToolConfig {
  hotkeySlot: number;
  icon: ReactNode;
  settings: ToolbarSettingControl[] | null;
}

export interface ToolbarResolvedContext {
  context: ToolbarSettingsContext;
  tool: Tool | null;
}

export interface ToolbarSettingDefinition {
  id: ToolbarSettingControl;
  component: ReactNode;
  isVisible?: (params: {
    tool: Tool;
    context: ToolbarSettingsContext;
  }) => boolean;
}
