import { resolveToolHotkeyLabel } from "@/components/Canvas/helpers/shortcutMatcher";
import { Tool } from "@/types";
import { SettingsSnapshot } from "@/types/settings";
import { TOOL_CONFIG } from "../../config";

interface ToolbarToolsListProps {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
  settingsSnapshot: SettingsSnapshot | null;
}

export const ToolbarToolsList: React.FC<ToolbarToolsListProps> = ({
  activeTool,
  onSelectTool,
  settingsSnapshot,
}) => (
  <menu className="toolbar">
    {/* TODO: switch to TOOL_ORDER when user-defined tool ordering is implemented. */}
    {Object.values(Tool).map((toolValue) => {
      const { hotkeySlot, icon } = TOOL_CONFIG[toolValue];
      const isActive = toolValue === activeTool;
      const hotkey = resolveToolHotkeyLabel(settingsSnapshot, hotkeySlot);

      return (
        <li className="toolbar-item" key={toolValue}>
          <button
            onClick={() => onSelectTool(toolValue)}
            className={`toolbar-tool-button ${isActive ? "--active" : ""}`}
            aria-pressed={isActive}
          >
            {icon}
            <span className={`toolbar-hotkey ${isActive ? "--active" : ""}`}>
              {hotkey}
            </span>
          </button>
        </li>
      );
    })}
  </menu>
);
