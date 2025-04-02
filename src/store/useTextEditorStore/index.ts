import { create } from "zustand";
import { TextEditorActions, TextEditorState } from "./types";

const initialState: TextEditorState = {
  startPoint: null,
  inputText: "",
};

export const useTextEditorStore = create<TextEditorState & TextEditorActions>(
  (set) => ({
    ...initialState,
    setStartPoint: (startPoint) => set({ startPoint }),
    setInputText: (inputText) => set({ inputText }),
    reset: () => set(initialState),
  })
);

export const useTextEditorStartPoint = () =>
  useTextEditorStore((state) => state.startPoint);
export const useSetTextEditorStartPoint = () =>
  useTextEditorStore((state) => state.setStartPoint);
export const useTextEditorInputText = () =>
  useTextEditorStore((state) => state.inputText);
export const useSetTextEditorInputText = () =>
  useTextEditorStore((state) => state.setInputText);
export const useResetTextEditorState = () =>
  useTextEditorStore((state) => state.reset);
