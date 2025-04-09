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
  GripVertical,
  Type,
} from "lucide-react";
import "./styles.css";
import { ColorOptions } from "./ColorOptions";
import { ThicknessOptions } from "./ThicknessOptions";
import Draggable from "react-draggable";
import { useToolbarVisibility } from "@/store/useToolbarStore";
import { FontSizeOptions } from "./FontSizeOptions";

const toolIcons = {
  Pen: <Pen size={14} />,
  Highlighter: <Highlighter size={14} />,
  Arrow: <ArrowUpRight size={14} />,
  Line: <Minus size={14} />,
  Rectangle: <Square size={14} />,
  Diamond: <Diamond size={14} />,
  Ellipse: <Circle size={14} />,
  Text: <Type size={14} />,
};

export const Toolbar: React.FC = () => {
  const tool = useTool();
  const setTool = useSetTool();
  const isVisible = useToolbarVisibility();

  return (
    <Draggable bounds="parent" handle=".grip-container" scale={1}>
      <div className={`toolbar-container ${!isVisible ? "--hidden" : ""}`}>
        <div className="toolbar-content">
          <menu className="toolbar">
            {Object.entries(Tool).map(([key, value], index) => {
              const isActive = value === tool;
              return (
                <li key={value}>
                  <button
                    onClick={() => setTool(value as Tool)}
                    className={isActive ? "--active" : undefined}
                    aria-pressed={value === tool}
                  >
                    {toolIcons[key as keyof typeof toolIcons]}
                    <span className={isActive ? "--active" : undefined}>
                      {index + 1}
                    </span>
                  </button>
                </li>
              );
            })}
          </menu>
          <hr />
          <div className="toolbar-settings">
            <ColorOptions />
            <hr className="--vertical" />
            {tool === Tool.Text ? <FontSizeOptions /> : <ThicknessOptions />}
          </div>
        </div>
        <div className="grip-container">
          <GripVertical size={14} className="toolbar-grip" />
          <GripVertical size={14} className="toolbar-grip" />
          <GripVertical size={14} className="toolbar-grip" />
        </div>
      </div>
    </Draggable>
  );
};
