import { StrokePoint, Tool } from "@/types";

export type TextEditorMode = "idle" | "create" | "edit";

export interface TextEditorState {
  mode: TextEditorMode;
  editingStrokeId: string | null;
  startPoint: StrokePoint | null;
  inputText: string;
  fontSizeSnapshot: number | null;
  colorSnapshot: string | null;
  returnToolOnFinish: Tool | null;
}

export interface TextEditorActions {
  startCreate: (startPoint: StrokePoint) => void;
  startEdit: (params: {
    strokeId: string;
    text: string;
    startPoint: StrokePoint;
    fontSize: number;
    color: string;
    returnToolOnFinish?: Tool | null;
  }) => void;
  setStartPoint: (startPoint: StrokePoint | null) => void;
  setInputText: (text: string) => void;
  finish: () => void;
  cancel: () => void;
  reset: () => void;
}
