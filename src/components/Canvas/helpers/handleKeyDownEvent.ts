import { toggleBackground } from "./toggleBackground";
import { useHistoryStore, useToolStore } from "../../../store";
import { Tool } from "../../../types";

const { undo, redo, clear, reset } = useHistoryStore.getState();
const { setTool } = useToolStore.getState();

export const handleKeyDownEvent = (event: KeyboardEvent) => {
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

  Object.values(Tool).forEach((toolItemKey) => {
    if (event.key === toolItemKey) {
      setTool(toolItemKey);
      return;
    }
  });
};
