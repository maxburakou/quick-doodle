import React, { useRef } from "react";
import "./styles.css";
import {
  useSetTextEditorStartPoint,
  useTextEditorStartPoint,
  useTool,
} from "@/store";
import { Tool } from "@/types";
import { AutoSizeTextarea } from "./AutoSizeTextarea";
import { handleInputSubmit } from "./helpers";

export const TextEditor: React.FC = () => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const tool = useTool();
  const isVisible = tool === Tool.Text;
  const point = useTextEditorStartPoint();
  const setPoint = useSetTextEditorStartPoint();
  const isEditable = isVisible && !!point;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();

    if (!point) {
      const newPoint = {
        x: e.nativeEvent.offsetX,
        y: e.nativeEvent.offsetY,
        pressure: e.pressure,
      };
      setPoint(newPoint);
      ref.current?.focus();
      return;
    }

    handleInputSubmit();
    ref.current?.blur();
  };

  if (!isVisible) return null;
  return (
    <section
      className={"text-editor-container"}
      onPointerDown={handlePointerDown}
    >
      {isEditable ? (
        <AutoSizeTextarea />
      ) : null}
    </section>
  );
};
