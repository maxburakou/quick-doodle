import { Stroke, Tool } from "@/types";
import { normalizeTextStroke } from "./textGeometry";
import { getCaretFromBoxStart } from "./textLayout";
import { useTextEditorStore } from "@/store/useTextEditorStore";

interface EnterTextEditOptions {
  returnToolOnFinish?: Tool;
}

export const enterTextEdit = (
  stroke: Stroke,
  options?: EnterTextEditOptions
) => {
  const normalizedStroke = normalizeTextStroke(stroke);
  const normalizedText = normalizedStroke.text ?? stroke.text!;
  const boundsStart = normalizedStroke.points[0] ?? {
    x: 0,
    y: 0,
    pressure: 0.5,
  };
  const caretPoint = getCaretFromBoxStart(
    boundsStart,
    normalizedText.fontSize
  );

  useTextEditorStore.getState().startEdit({
    strokeId: normalizedStroke.id,
    text: normalizedText.value,
    startPoint: { ...boundsStart, ...caretPoint },
    fontSize: normalizedText.fontSize,
    color: normalizedStroke.color,
    returnToolOnFinish: options?.returnToolOnFinish,
  });

  return { normalizedStroke, normalizedText };
};
