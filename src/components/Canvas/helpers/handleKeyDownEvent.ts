import { toggleBackground } from "./toggleBackground";
import { useHistoryStore, useToolSettingsStore, useToolStore } from "@/store";
import { Tool } from "@/types";

const { undo, redo, clear, reset } = useHistoryStore.getState();
const { setTool } = useToolStore.getState();
const { toNextColor, toPrevColor, toNextThickness, toPrevThickness } =
  useToolSettingsStore.getState();

export const handleKeyDownEvent = (event: KeyboardEvent) => {
  event.preventDefault();

  const { metaKey, shiftKey, code } = event;

  if (shiftKey && metaKey && code === "KeyZ") {
    redo();
    return;
  }

  if (metaKey && code === "KeyZ") {
    undo();
    return;
  }

  if (metaKey && code === "KeyC") {
    clear();
    return;
  }

  if (metaKey && code === "KeyR") {
    reset();
    return;
  }

  if (metaKey && code === "KeyA") {
    toggleBackground();
    return;
  }

  Object.values(Tool).forEach((toolItemKey) => {
    if (code === `Digit${toolItemKey}` || code === `Numpad${toolItemKey}`) {
      setTool(toolItemKey);
      return;
    }
  });

  if (shiftKey && code === "BracketLeft") {
    toPrevColor();
    return;
  }

  if (shiftKey && code === "BracketRight") {
    toNextColor();
    return;
  }

  if (code === "BracketLeft") {
    toPrevThickness();
    return;
  }

  if (code === "BracketRight") {
    toNextThickness();
    return;
  }
};
