import { ShortcutSectionDefinition } from "../types";

export const SHORTCUT_SECTIONS: ShortcutSectionDefinition[] = [
  {
    id: "canvas-store",
    title: "Canvas / Store",
    scope: "canvas.history",
    actions: [
      { actionId: "undo", label: "Undo" },
      { actionId: "redo", label: "Redo" },
      { actionId: "clear", label: "Clear" },
      { actionId: "reset", label: "Reset" },
    ],
  },
  {
    id: "canvas-toggle",
    title: "Canvas / Toggle",
    scope: "canvas.toggles",
    actions: [
      { actionId: "toolbar", label: "Toggle Toolbar" },
      { actionId: "background", label: "Toggle Background" },
      { actionId: "snap", label: "Toggle Snap" },
    ],
  },
  {
    id: "canvas-tool",
    title: "Canvas / Tool",
    scope: "canvas.tools",
    actions: [
      { actionId: "tool_1", label: "Tool 1" },
      { actionId: "tool_2", label: "Tool 2" },
      { actionId: "tool_3", label: "Tool 3" },
      { actionId: "tool_4", label: "Tool 4" },
      { actionId: "tool_5", label: "Tool 5" },
      { actionId: "tool_6", label: "Tool 6" },
      { actionId: "tool_7", label: "Tool 7" },
      { actionId: "tool_8", label: "Tool 8" },
      { actionId: "tool_9", label: "Tool 9" },
    ],
  },
  {
    id: "global",
    title: "Global",
    scope: "global",
    actions: [
      { actionId: "toggle_canvas", label: "Toggle Canvas" },
      { actionId: "new_canvas", label: "New Canvas" },
    ],
  },
];
