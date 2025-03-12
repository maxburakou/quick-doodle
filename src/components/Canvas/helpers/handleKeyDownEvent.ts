import { toggleBackground } from "./toggleBackground";
import { useHistoryStore, useToolStore } from "../../../store";
import { Tool } from "../../../types";

const { undo, redo, clear, reset } = useHistoryStore.getState();
const { setTool } = useToolStore.getState();

export const handleKeyDownEvent = (
  event: KeyboardEvent,
) => {
  event.preventDefault();

  if (event.shiftKey && event.metaKey && event.key === "z") {
    redo();
    return;
  }

  if (event.metaKey && event.key === "z") {
    undo();
    return;
  }

  if (event.metaKey && event.key === "c") {
    clear();
    return;
  }

  if (event.metaKey && event.key === "r") {
    reset();
    return;
  }

  if (event.metaKey && event.key === "a") {
    toggleBackground();
    return;
  }

  if (event.key === Tool.Pen) {
    setTool(Tool.Pen);
    return;
  }

  if (event.key === Tool.Highlighter) {
    setTool(Tool.Highlighter);
    return;
  }

  if (event.key === Tool.Arrow) {
    setTool(Tool.Arrow);
    return;
  }

  if (event.key === Tool.Line) {
    setTool(Tool.Line);
    return;
  }

  if (event.key === Tool.Rectangle) {
    setTool(Tool.Rectangle);
    return;
  }

  if (event.key === Tool.Ellipse) {
    setTool(Tool.Ellipse);
    return;
  }

  if (event.key === Tool.Text) {
    setTool(Tool.Text);
    return;
  }
};
