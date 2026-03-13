import {
  useHistoryStore,
  useShapeEditorStore,
  useTextEditorStore,
  useTextSettingsStore,
  useToolSettingsStore,
} from "@/store";
import { Stroke, TextElement, Tool } from "@/types";
import { createStrokeId } from "@/store/useShapeEditorStore/helpers";
import { moveStrokeIdsToEnd } from "@/store/useShapeEditorStore/helpers";
import {
  normalizeTextStroke,
} from "@/components/Canvas/utils/textGeometry";
import {
  getBoxStartFromCaret,
  measureTextBox,
} from "@/components/Canvas/utils/textLayout";

export const handleInputSubmit = () => {
  const {
    mode,
    inputText,
    startPoint,
    editingStrokeId,
    finish,
  } = useTextEditorStore.getState();
  if (mode === "idle") return;

  const { addAction, present, commitPresent } = useHistoryStore.getState();
  const { clearSelection } = useShapeEditorStore.getState();
  const { color } = useToolSettingsStore.getState();
  const { fontSize } = useTextSettingsStore.getState();
  const hasText = inputText.length > 0;

  if (mode === "create") {
    if (hasText && startPoint) {
      const metrics = measureTextBox(inputText, fontSize);
      const boxStart = getBoxStartFromCaret(startPoint, fontSize);
      const text: TextElement = {
        value: inputText,
        fontSize,
        width: metrics.width,
        height: metrics.height,
      };

      const stroke: Stroke = {
        id: createStrokeId(),
        points: [
          {
            ...startPoint,
            y: boxStart.y,
          },
          {
            x: startPoint.x + metrics.width,
            y: boxStart.y + metrics.height,
            pressure: startPoint.pressure,
          },
        ],
        color,
        thickness: fontSize,
        tool: Tool.Text,
        text,
        rotation: 0,
      };
      addAction(stroke);
    }

    finish();
    return;
  }

  if (mode === "edit" && editingStrokeId) {
    const finishEdit = () => {
      clearSelection();
      finish();
    };

    const currentStroke = present.find((stroke) => stroke.id === editingStrokeId);
    if (!currentStroke || !currentStroke.text) {
      finishEdit();
      return;
    }

    if (!hasText) {
      commitPresent(present.filter((stroke) => stroke.id !== editingStrokeId));
      finishEdit();
      return;
    }

    const normalizedStroke = normalizeTextStroke(currentStroke);
    const start = normalizedStroke.points[0];
    const end = normalizedStroke.points[1] ?? start;
    const nextFontSize = fontSize;
    const metrics = measureTextBox(inputText, nextFontSize);
    const rotation = normalizedStroke.rotation ?? 0;
    const shouldPreserveCenter = rotation !== 0;

    const nextStart = shouldPreserveCenter
      ? {
          x: (start.x + end.x) / 2 - metrics.width / 2,
          y: (start.y + end.y) / 2 - metrics.height / 2,
          pressure: start.pressure,
        }
      : start;

    const updatedStroke: Stroke = {
      ...normalizedStroke,
      color,
      thickness: nextFontSize,
      text: {
        ...normalizedStroke.text,
        value: inputText,
        fontSize: nextFontSize,
        width: metrics.width,
        height: metrics.height,
      },
      points: [
        nextStart,
        {
          x: nextStart.x + metrics.width,
          y: nextStart.y + metrics.height,
          pressure: end.pressure ?? start.pressure,
        },
      ],
    };

    const replacedPresent = present.map((stroke) =>
      stroke.id === editingStrokeId ? updatedStroke : stroke
    );
    const nextPresent = moveStrokeIdsToEnd(replacedPresent, [editingStrokeId]);
    commitPresent(nextPresent);
    finishEdit();
    return;
  }

  finish();
};
