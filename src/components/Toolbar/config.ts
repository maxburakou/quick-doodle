import { Tool } from "@/types";
import { createElement } from "react";
import {
  ArrowUpRight,
  Circle,
  Diamond,
  Highlighter,
  Minus,
  MousePointer2,
  Pen,
  Square,
  Type,
} from "lucide-react";
import {
  TOOLBAR_SETTING_CONTROL,
  ToolbarSettingControl,
  ToolbarSettingDefinition,
  ToolbarToolConfig,
} from "./types";
import { ColorOptions } from "./ColorOptions";
import { ThicknessOptions } from "./ThicknessOptions";
import { FontSizeOptions } from "./FontSizeOptions";

export const TOOL_CONFIG: Record<Tool, ToolbarToolConfig> = {
  [Tool.Pen]: {
    hotkeySlot: 1,
    icon: createElement(Pen, { size: 14 }),
    settings: [TOOLBAR_SETTING_CONTROL.COLOR, TOOLBAR_SETTING_CONTROL.STROKE],
  },
  [Tool.Highlighter]: {
    hotkeySlot: 2,
    icon: createElement(Highlighter, { size: 14 }),
    settings: [TOOLBAR_SETTING_CONTROL.COLOR, TOOLBAR_SETTING_CONTROL.STROKE],
  },
  [Tool.Arrow]: {
    hotkeySlot: 3,
    icon: createElement(ArrowUpRight, { size: 14 }),
    settings: [TOOLBAR_SETTING_CONTROL.COLOR, TOOLBAR_SETTING_CONTROL.STROKE],
  },
  [Tool.Line]: {
    hotkeySlot: 4,
    icon: createElement(Minus, { size: 14 }),
    settings: [TOOLBAR_SETTING_CONTROL.COLOR, TOOLBAR_SETTING_CONTROL.STROKE],
  },
  [Tool.Rectangle]: {
    hotkeySlot: 5,
    icon: createElement(Square, { size: 14 }),
    settings: [TOOLBAR_SETTING_CONTROL.COLOR, TOOLBAR_SETTING_CONTROL.STROKE],
  },
  [Tool.Diamond]: {
    hotkeySlot: 6,
    icon: createElement(Diamond, { size: 14 }),
    settings: [TOOLBAR_SETTING_CONTROL.COLOR, TOOLBAR_SETTING_CONTROL.STROKE],
  },
  [Tool.Ellipse]: {
    hotkeySlot: 7,
    icon: createElement(Circle, { size: 14 }),
    settings: [TOOLBAR_SETTING_CONTROL.COLOR, TOOLBAR_SETTING_CONTROL.STROKE],
  },
  [Tool.Text]: {
    hotkeySlot: 8,
    icon: createElement(Type, { size: 14 }),
    settings: [
      TOOLBAR_SETTING_CONTROL.COLOR,
      TOOLBAR_SETTING_CONTROL.TEXT_SIZE,
    ],
  },
  [Tool.Select]: {
    hotkeySlot: 9,
    icon: createElement(MousePointer2, { size: 14 }),
    settings: null,
  },
};

// Placeholder for future user-defined toolbar tool order.
export const TOOL_ORDER: Tool[] = [
  Tool.Pen,
  Tool.Highlighter,
  Tool.Arrow,
  Tool.Line,
  Tool.Rectangle,
  Tool.Diamond,
  Tool.Ellipse,
  Tool.Text,
  Tool.Select,
];

export const SETTING_REGISTRY: Record<
  ToolbarSettingControl,
  ToolbarSettingDefinition
> = {
  [TOOLBAR_SETTING_CONTROL.COLOR]: {
    id: TOOLBAR_SETTING_CONTROL.COLOR,
    component: createElement(ColorOptions),
    isVisible: () => true,
  },
  [TOOLBAR_SETTING_CONTROL.STROKE]: {
    id: TOOLBAR_SETTING_CONTROL.STROKE,
    component: createElement(ThicknessOptions),
    isVisible: ({ tool }) => tool !== Tool.Text && tool !== Tool.Select,
  },
  [TOOLBAR_SETTING_CONTROL.TEXT_SIZE]: {
    id: TOOLBAR_SETTING_CONTROL.TEXT_SIZE,
    component: createElement(FontSizeOptions),
    isVisible: ({ tool }) => tool === Tool.Text,
  },
};
