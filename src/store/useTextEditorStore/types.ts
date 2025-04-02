import { StrokePoint } from "@/types";

export interface TextEditorState {
  startPoint: StrokePoint | null;
  inputText: string;
}

export interface TextEditorActions {
  setStartPoint: (startPoint: StrokePoint | null) => void;
  setInputText: (text: string) => void;
  reset: () => void;
}
