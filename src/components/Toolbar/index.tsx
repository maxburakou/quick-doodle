import { Fragment, ReactNode } from "react";
import { useSetTool, useTool } from "@/store";
import { Tool } from "@/types";
import {
  Pen,
  Highlighter,
  ArrowUpRight,
  Minus,
  Square,
  Diamond,
  Circle,
  Type,
  MousePointer2,
} from "lucide-react";
import "./styles.css";
import { ColorOptions } from "./ColorOptions";
import { ThicknessOptions } from "./ThicknessOptions";
import Draggable from "react-draggable";
import { useToolbarVisibility } from "@/store/useToolbarStore";
import { FontSizeOptions } from "./FontSizeOptions";
import { TOOL_META, TOOL_CONFIG } from "./config";
import { ToolbarSettingControl } from "./types";

const TOOL_ICONS: Record<Tool, ReactNode> = {
  [Tool.Pen]: <Pen size={14} />,
  [Tool.Highlighter]: <Highlighter size={14} />,
  [Tool.Arrow]: <ArrowUpRight size={14} />,
  [Tool.Line]: <Minus size={14} />,
  [Tool.Rectangle]: <Square size={14} />,
  [Tool.Diamond]: <Diamond size={14} />,
  [Tool.Ellipse]: <Circle size={14} />,
  [Tool.Text]: <Type size={14} />,
  [Tool.Select]: <MousePointer2 size={14} />,
};

const CONTROL_COMPONENTS: Record<ToolbarSettingControl, ReactNode> = {
  color: <ColorOptions />,
  stroke: <ThicknessOptions />,
  textSize: <FontSizeOptions />,
};

export const Toolbar: React.FC = () => {
  const tool = useTool();
  const setTool = useSetTool();
  const isVisible = useToolbarVisibility();
  const settings = TOOL_CONFIG[tool]?.settings ?? null;
  const shouldShowSettings = Array.isArray(settings) && settings.length > 0;

  return (
    <Draggable bounds="parent" handle=".grip-container" scale={1}>
      <div className={`toolbar-container ${!isVisible ? "--hidden" : ""}`}>
        <div className="toolbar-content">
          <menu className="toolbar">
            {TOOL_META.map(({ tool: toolValue, hotkey }) => {
              const isActive = toolValue === tool;
              return (
                <li className="toolbar-item" key={toolValue}>
                  <button
                    onClick={() => setTool(toolValue)}
                    className={`toolbar-tool-button ${isActive ? "--active" : ""}`}
                    aria-pressed={isActive}
                  >
                    {TOOL_ICONS[toolValue]}
                    <span className={`toolbar-hotkey ${isActive ? "--active" : ""}`}>
                      {hotkey}
                    </span>
                  </button>
                </li>
              );
            })}
          </menu>
          {shouldShowSettings ? (
            <>
              <hr className="toolbar-divider" />
              <div className="toolbar-settings">
                {settings?.map((control, index) => (
                  <Fragment key={control}>
                    {index > 0 ? <hr className="toolbar-divider --vertical" /> : null}
                    {CONTROL_COMPONENTS[control]}
                  </Fragment>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <div className="grip-container" aria-hidden />
      </div>
    </Draggable>
  );
};
