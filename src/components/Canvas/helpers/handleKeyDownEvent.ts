import {
  useCanvasStore,
  useHistoryStore,
  useSnapStore,
  useShapeEditorStore,
  useTextSettingsStore,
  useTextEditorStore,
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
const { toggleEnabled: toggleSnap } = useSnapStore.getState();
const { toNextFontSize, toPrevFontSize } = useTextSettingsStore.getState();

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable || tagName === "input" || tagName === "textarea"
  );
};

export const handleKeyDownEvent = (event: KeyboardEvent) => {
  if (isTypingTarget(event.target)) return;

  const { metaKey, shiftKey, code } = event;
  const isDeleteShortcut = code === "Delete" || code === "Backspace";
  const textEditorMode = useTextEditorStore.getState().mode;

  if (isDeleteShortcut && textEditorMode !== "edit" && textEditorMode !== "create") {
    event.preventDefault();

    const { selectedStrokeIds, clearSelection } = useShapeEditorStore.getState();
    if (selectedStrokeIds.length === 0) return;

    const { present, commitPresent } = useHistoryStore.getState();
    const selectedIds = new Set(selectedStrokeIds);
    const nextPresent = present.filter((stroke) => !selectedIds.has(stroke.id));
    if (nextPresent.length === present.length) return;

    commitPresent(nextPresent);
    clearSelection();
    return;
  }

  event.preventDefault();

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

  if (metaKey && code === "KeyE") {
    toggleSnap();
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
