import {
  useCanvasStore,
  useHistoryStore,
  useTextSettingsStore,
  useToolSettingsStore,
  useToolStore,
} from "@/store";
import { useToolbarStore } from "@/store/useToolbarStore";
import { Tool } from "@/types";

const { undo, redo, clear, reset } = useHistoryStore.getState();
const { setTool } = useToolStore.getState();
const { toNextColor, toPrevColor, toNextThickness, toPrevThickness } =
  useToolSettingsStore.getState();
const { toggleBackground: toggleCanvas } = useCanvasStore.getState();
const { toggleVisibility: toggleToolbar } = useToolbarStore.getState();
const { toNextFontSize, toPrevFontSize } = useTextSettingsStore.getState();

export const handleKeyDownEvent = (event: KeyboardEvent) => {
  event.preventDefault();

  const { metaKey, shiftKey, code } = event;

  const { tool } = useToolStore.getState();

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
    toggleCanvas();
    return;
  }

  if (metaKey && code === "KeyQ") {
    toggleToolbar();
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
    if (tool === Tool.Text) {
      toPrevFontSize();
      return;
    }
    toPrevThickness();
    return;
  }

  if (code === "BracketRight") {
    if (tool === Tool.Text) {
      toNextFontSize();
      return;
    }
    toNextThickness();
    return;
  }
};
