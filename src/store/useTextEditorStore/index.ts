import { create } from "zustand";
import { TextEditorActions, TextEditorState } from "./types";

const initialState: TextEditorState = {
  mode: "idle",
  editingStrokeId: null,
  startPoint: null,
  inputText: "",
  fontSizeSnapshot: null,
};

export const useTextEditorStore = create<TextEditorState & TextEditorActions>(
  (set) => ({
    ...initialState,
    startCreate: (startPoint) =>
      set({
        mode: "create",
        editingStrokeId: null,
        startPoint,
        inputText: "",
        fontSizeSnapshot: null,
      }),
    startEdit: ({ strokeId, text, startPoint, fontSize }) =>
      set({
        mode: "edit",
        editingStrokeId: strokeId,
        startPoint,
        inputText: text,
        fontSizeSnapshot: fontSize,
      }),
    setStartPoint: (startPoint) => set({ startPoint }),
    setInputText: (inputText) => set({ inputText }),
    finish: () => set(initialState),
    cancel: () => set(initialState),
    reset: () => set(initialState),
  })
);

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
