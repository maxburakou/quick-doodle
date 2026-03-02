import { useSetTool, useTool } from "@/store";
import "./styles.css";
import Draggable from "react-draggable";
import { useToolbarVisibility } from "@/store/useToolbarStore";
import { useSettingsStore } from "@/store";
import { ToolbarSettingsPanel } from "./components/ToolbarSettingsPanel";
import { ToolbarToolsList } from "./components/ToolbarToolsList";
import { useToolbarSettingsContext } from "./hooks/useToolbarSettingsContext";

export const Toolbar: React.FC = () => {
  const activeTool = useTool();
  const setTool = useSetTool();
  const isVisible = useToolbarVisibility();
  const settingsSnapshot = useSettingsStore((state) => state.snapshot);
  const { visibleSettings } = useToolbarSettingsContext();

  return (
    <Draggable bounds="parent" handle=".grip-container" scale={1}>
      <div className={`toolbar-container ${!isVisible ? "--hidden" : ""}`}>
        <div className="toolbar-content">
          <ToolbarToolsList
            activeTool={activeTool}
            onSelectTool={setTool}
            settingsSnapshot={settingsSnapshot}
          />
          <ToolbarSettingsPanel visibleSettings={visibleSettings} />
        </div>
        <div className="grip-container" aria-hidden />
      </div>
    </Draggable>
  );
};
