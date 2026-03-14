import { resolveToolHotkeyLabel } from "@/components/Canvas/helpers/shortcutMatcher";
import { Tool } from "@/types";
import { SettingsSnapshot } from "@/types/settings";
import { TOOL_CONFIG } from "../../config";
import "./styles.css";

interface ToolbarToolsListProps {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
  settingsSnapshot: SettingsSnapshot | null;
}

const TOOLS_LIST = Object.values(Tool);

export const ToolbarToolsList: React.FC<ToolbarToolsListProps> = ({
  activeTool,
  onSelectTool,
  settingsSnapshot,
}) => {
  return (
    <menu className="toolbar toolbar-capsule-enabled">
      <div className="toolbar-active-capsule" aria-hidden />
      {/* TODO: switch to TOOL_ORDER when user-defined tool ordering is implemented. */}
      {TOOLS_LIST.map((toolValue) => {
        const { hotkeySlot, icon } = TOOL_CONFIG[toolValue];
        const isActive = toolValue === activeTool;
        const hotkey = resolveToolHotkeyLabel(settingsSnapshot, hotkeySlot);

        return (
          <li className="toolbar-item" key={toolValue}>
            <button
              onClick={() => onSelectTool(toolValue)}
              className={`toolbar-tool-button ${isActive ? "--capsule-active" : ""}`}
              aria-pressed={isActive}
            >
              {icon}
              <span className={`toolbar-hotkey ${isActive ? "--capsule-active" : ""}`}>
                {hotkey}
              </span>
            </button>
          </li>
        );
      })}
    </menu>
  );
};
