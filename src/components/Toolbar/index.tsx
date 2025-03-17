import { useToolStore } from "../../store";
import { Tool } from "../../types";
import {
  Pen,
  Highlighter,
  ArrowUpRight,
  Minus,
  Square,
  Diamond,
  Circle,
} from "lucide-react";
import "./styles.css";

const toolIcons = {
  Pen: <Pen size={14} />,
  Highlighter: <Highlighter size={14} />,
  Arrow: <ArrowUpRight size={14} />,
  Line: <Minus size={14} />,
  Rectangle: <Square size={14} />,
  Diamond: <Diamond size={14} />,
  Ellipse: <Circle size={14} />,
};

export const Toolbar: React.FC = () => {
  const { tool, setTool } = useToolStore();

  return (
    <menu>
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
  );
};
