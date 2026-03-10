import React, { useRef } from "react";
import "./styles.css";
import {
  useSetFontSize,
  usePresent,
  useSetShapeSelection,
  useSetToolColor,
  useStartTextEditorCreate,
  useTextEditorMode,
  useTextEditorStartPoint,
  useTool,
} from "@/store";
import { Tool } from "@/types";
import { hitTestText } from "@/components/Canvas/utils/textGeometry";
import { enterTextEdit } from "@/components/Canvas/utils/enterTextEdit";
import { AutoSizeTextarea } from "./AutoSizeTextarea";
import { handleInputSubmit } from "./helpers";

export const TextEditor: React.FC = () => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const tool = useTool();
  const mode = useTextEditorMode();
  const present = usePresent();
  const setSelection = useSetShapeSelection();
  const setToolColor = useSetToolColor();
  const setFontSize = useSetFontSize();
  const isVisible = tool === Tool.Text || mode === "edit" || mode === "create";
  const point = useTextEditorStartPoint();
  const startCreate = useStartTextEditorCreate();
  const isEditable = (mode === "create" || mode === "edit") && !!point;

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();

    if (tool === Tool.Text && mode === "idle") {
      const rect = e.currentTarget.getBoundingClientRect();
      const newPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure,
      };

      const hitTextStroke = [...present]
        .reverse()
        .find((stroke) => stroke.tool === Tool.Text && stroke.text && hitTestText(stroke, newPoint));

      if (hitTextStroke?.text) {
        const { normalizedStroke, normalizedText } = enterTextEdit(
          hitTextStroke,
          { returnToolOnFinish: Tool.Text }
        );
        setToolColor(normalizedStroke.color);
        setFontSize(normalizedText.fontSize);
        setSelection([normalizedStroke.id], normalizedStroke.id);
        ref.current?.focus();
        return;
      }

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
    <section className="text-editor-container" onPointerDown={handlePointerDown}>
      {isEditable ? (
        <AutoSizeTextarea />
      ) : null}
    </section>
  );
};
