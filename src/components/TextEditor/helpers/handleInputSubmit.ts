import {
  useHistoryStore,
  useTextEditorStore,
  useTextSettingsStore,
  useToolSettingsStore,
  useToolStore,
} from "@/store";
import { Stroke, TextElement } from "@/types";

const { addAction } = useHistoryStore.getState();

export const handleInputSubmit = () => {
  const { inputText, startPoint, reset } = useTextEditorStore.getState();
  const { color } = useToolSettingsStore.getState();
  const { fontSize } = useTextSettingsStore.getState();
  const { tool } = useToolStore.getState();

  const text: TextElement = {
    value: inputText,
    fontSize,
  };

  if (inputText && startPoint) {
    const stroke: Stroke = {
      points: [startPoint],
      color,
      thickness: fontSize,
      tool,
      text,
    };
    addAction(stroke);
  }

  reset();
};
