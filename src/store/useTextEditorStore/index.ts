import { create } from "zustand";
import { TextEditorActions, TextEditorState } from "./types";
import { useToolStore } from "../useToolStore";
import { Tool } from "@/types";

const initialState: TextEditorState = {
  mode: "idle",
  editingStrokeId: null,
  startPoint: null,
  inputText: "",
  fontSizeSnapshot: null,
  colorSnapshot: null,
  returnToolOnFinish: null,
};

export const useTextEditorStore = create<TextEditorState & TextEditorActions>((set, get) => {
  const completeEditorSession = () => {
    const returnTool = get().returnToolOnFinish;
    const { tool: currentTool, setTool } = useToolStore.getState();

    set(initialState);
    if (returnTool !== null && currentTool === Tool.Text) {
      setTool(returnTool);
    }
  };

  return {
    ...initialState,
    startCreate: (startPoint) =>
      set({
        mode: "create",
        editingStrokeId: null,
        startPoint,
        inputText: "",
        fontSizeSnapshot: null,
        colorSnapshot: null,
        returnToolOnFinish: null,
      }),
    startEdit: ({
      strokeId,
      text,
      startPoint,
      fontSize,
      color,
      returnToolOnFinish,
    }) =>
      set({
        mode: "edit",
        editingStrokeId: strokeId,
        startPoint,
        inputText: text,
        fontSizeSnapshot: fontSize,
        colorSnapshot: color,
        returnToolOnFinish: returnToolOnFinish ?? null,
      }),
    setStartPoint: (startPoint) => set({ startPoint }),
    setInputText: (inputText) => set({ inputText }),
    finish: completeEditorSession,
    cancel: completeEditorSession,
    reset: () => set(initialState),
  };
});

export const useTextEditorMode = () => useTextEditorStore((state) => state.mode);
export const useTextEditorEditingStrokeId = () =>
  useTextEditorStore((state) => state.editingStrokeId);
export const useTextEditorStartPoint = () =>
  useTextEditorStore((state) => state.startPoint);
export const useStartTextEditorCreate = () =>
  useTextEditorStore((state) => state.startCreate);
export const useStartTextEditorEdit = () =>
  useTextEditorStore((state) => state.startEdit);
export const useSetTextEditorStartPoint = () =>
  useTextEditorStore((state) => state.setStartPoint);
export const useTextEditorInputText = () =>
  useTextEditorStore((state) => state.inputText);
export const useSetTextEditorInputText = () =>
  useTextEditorStore((state) => state.setInputText);
export const useTextEditorFontSizeSnapshot = () =>
  useTextEditorStore((state) => state.fontSizeSnapshot);
export const useFinishTextEditor = () =>
  useTextEditorStore((state) => state.finish);
export const useCancelTextEditor = () =>
  useTextEditorStore((state) => state.cancel);
export const useResetTextEditorState = () =>
  useTextEditorStore((state) => state.reset);
