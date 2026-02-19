import React, { useRef } from "react";
import "./styles.css";
import {
  useStartTextEditorCreate,
  useTextEditorMode,
  useTextEditorStartPoint,
  useTool,
} from "@/store";
import { Tool } from "@/types";
import { AutoSizeTextarea } from "./AutoSizeTextarea";
import { handleInputSubmit } from "./helpers";

export const TextEditor: React.FC = () => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const tool = useTool();
  const mode = useTextEditorMode();
  const isVisible = tool === Tool.Text || mode === "edit" || mode === "create";
  const point = useTextEditorStartPoint();
  const startCreate = useStartTextEditorCreate();
  const isEditable = (mode === "create" || mode === "edit") && !!point;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();

    if (tool === Tool.Text && mode === "idle") {
      const newPoint = {
        x: e.nativeEvent.offsetX,
        y: e.nativeEvent.offsetY,
        pressure: e.pressure,
      };
      startCreate(newPoint);
      ref.current?.focus();
      return;
    }

    if (mode === "create" || mode === "edit") {
      handleInputSubmit();
      ref.current?.blur();
    }
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
