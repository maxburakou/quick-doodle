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
import { resolveCanvasShortcutAction } from "./shortcutMatcher";

const { undo, redo, clear, reset } = useHistoryStore.getState();
const { setTool } = useToolStore.getState();
const { toNextColor, toPrevColor, toNextThickness, toPrevThickness } =
  useToolSettingsStore.getState();
const { toggleBackground: toggleCanvas } = useCanvasStore.getState();
const { toggleVisibility: toggleToolbar } = useToolbarStore.getState();
const { toggleEnabled: toggleSnap } = useSnapStore.getState();
const { toNextFontSize, toPrevFontSize } = useTextSettingsStore.getState();
const TOOL_VALUES = new Set(Object.values(Tool));
const TOOL_ACTION_PREFIX = "canvas.tools.tool_";

const ACTION_HANDLERS: Record<string, () => void> = {
  "canvas.history.undo": undo,
  "canvas.history.redo": redo,
  "canvas.history.clear": clear,
  "canvas.history.reset": reset,
  "canvas.toggles.background": toggleCanvas,
  "canvas.toggles.toolbar": toggleToolbar,
  "canvas.toggles.snap": toggleSnap,
};

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable || tagName === "input" || tagName === "textarea"
  );
};

const applyShortcutAction = (actionId: string) => {
  const actionHandler = ACTION_HANDLERS[actionId];
  if (actionHandler) {
    actionHandler();
    return true;
  }

  if (actionId.startsWith(TOOL_ACTION_PREFIX)) {
    const slot = actionId.replace(TOOL_ACTION_PREFIX, "");
    if (TOOL_VALUES.has(slot as Tool)) {
      setTool(slot as Tool);
      return true;
    }
  }

  return false;
};

export const handleKeyDownEvent = (event: KeyboardEvent) => {
  if (isTypingTarget(event.target)) return;

  const { code, shiftKey } = event;
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

  const actionId = resolveCanvasShortcutAction(event);
  if (actionId) {
    event.preventDefault();
    if (applyShortcutAction(actionId)) {
      return;
    }
  }

  const { tool } = useToolStore.getState();

  if (shiftKey && code === "BracketLeft") {
    event.preventDefault();
    toPrevColor();
    return;
  }

  if (shiftKey && code === "BracketRight") {
    event.preventDefault();
    toNextColor();
    return;
  }

  if (code === "BracketLeft") {
    event.preventDefault();
    if (tool === Tool.Text) {
      toPrevFontSize();
      return;
    }
    toPrevThickness();
    return;
  }

  if (code === "BracketRight") {
    event.preventDefault();
    if (tool === Tool.Text) {
      toNextFontSize();
      return;
    }
    toNextThickness();
  }
};
