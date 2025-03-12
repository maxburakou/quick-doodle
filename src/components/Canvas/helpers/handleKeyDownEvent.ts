import { toggleBackground } from "./toggleBackground";
import { useHistoryStore } from "../../../store";

const { undo, redo, clear, reset } = useHistoryStore.getState();

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
};
