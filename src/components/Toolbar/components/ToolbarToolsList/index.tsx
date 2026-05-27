import { resolveToolHotkeyLabel } from "@/components/Canvas/helpers/shortcutMatcher";
import { Tool } from "@/types";
import { SettingsSnapshot } from "@/types/settings";
import { TOOL_CONFIG } from "../../config";
import { SlidingCapsuleRail } from "../SlidingCapsuleRail";
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
  const renderToolVisual = (toolValue: Tool, lens = false) => {
    const { hotkeySlot, icon } = TOOL_CONFIG[toolValue];
    const hotkey = resolveToolHotkeyLabel(settingsSnapshot, hotkeySlot);

    return (
      <>
        {icon}
        <span className={`toolbar-hotkey ${lens ? "--lens" : ""}`}>{hotkey}</span>
      </>
    );
  };

  return (
    <SlidingCapsuleRail
      items={TOOLS_LIST}
      activeItem={activeTool}
      onSelectItem={onSelectTool}
      renderItem={renderToolVisual}
      lensScale={1.04}
      lensCover={1}
      lensGlow={0.6}
    />
  );
};
