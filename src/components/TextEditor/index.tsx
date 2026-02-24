import React, { useRef } from "react";
import "./styles.css";
import {
  useSetFontSize,
  usePresent,
  useSetShapeSelection,
  useSetToolColor,
  useStartTextEditorCreate,
  useStartTextEditorEdit,
  useTextEditorMode,
  useTextEditorStartPoint,
  useTool,
} from "@/store";
import { Tool } from "@/types";
import { hitTestText, normalizeTextStroke } from "@/components/Canvas/utils/textGeometry";
import { getCaretFromBoxStart } from "@/components/Canvas/utils/textLayout";
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
  const startEdit = useStartTextEditorEdit();
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
        const normalizedTextStroke = normalizeTextStroke(hitTextStroke);
        const normalizedText = normalizedTextStroke.text ?? hitTextStroke.text;
        const boundsStart = normalizedTextStroke.points[0] ?? {
          x: 0,
          y: 0,
          pressure: 0.5,
        };
        const caretPoint = getCaretFromBoxStart(
          boundsStart,
          normalizedText.fontSize
        );

        startEdit({
          strokeId: normalizedTextStroke.id,
          text: normalizedText.value,
          startPoint: {
            ...boundsStart,
            ...caretPoint,
          },
          fontSize: normalizedText.fontSize,
          color: normalizedTextStroke.color,
          returnToolOnFinish: Tool.Text,
        });
        setToolColor(normalizedTextStroke.color);
        setFontSize(normalizedText.fontSize);
        setSelection([normalizedTextStroke.id], normalizedTextStroke.id);
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
