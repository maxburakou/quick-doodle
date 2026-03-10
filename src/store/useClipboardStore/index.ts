import { create } from "zustand";
import { Stroke } from "@/types";
import { useHistoryStore } from "../useHistoryStore";
import { useShapeEditorStore } from "../useShapeEditorStore";
import { createStrokeId } from "../useShapeEditorStore/helpers";
import { ClipboardState } from "./types";

const PASTE_OFFSET_STEP = 16;

const cloneStroke = (stroke: Stroke): Stroke => ({
  ...stroke,
  points: stroke.points.map((point) => ({ ...point })),
  text: stroke.text ? { ...stroke.text } : undefined,
  shapeFill: stroke.shapeFill ? { ...stroke.shapeFill } : undefined,
});

const getSelectedStrokesSnapshot = () => {
  const { present } = useHistoryStore.getState();
  const { selectedStrokeIds } = useShapeEditorStore.getState();
  if (selectedStrokeIds.length === 0) return [];

  const selectedIds = new Set(selectedStrokeIds);
  return present
    .filter((stroke) => selectedIds.has(stroke.id))
    .map((stroke) => cloneStroke(stroke));
};

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  strokesSnapshot: [],
  pasteCount: 0,
  lastPasteIds: [],

  copySelection: () => {
    const strokesSnapshot = getSelectedStrokesSnapshot();
    if (strokesSnapshot.length === 0) return false;

    set({
      strokesSnapshot,
      pasteCount: 0,
      lastPasteIds: [],
    });
    return true;
  },

  cutSelection: () => {
    const { present, commitPresent } = useHistoryStore.getState();
    const { selectedStrokeIds, clearSelection } = useShapeEditorStore.getState();
    if (selectedStrokeIds.length === 0) return false;

    const selectedIds = new Set(selectedStrokeIds);
    const strokesSnapshot = present
      .filter((stroke) => selectedIds.has(stroke.id))
      .map((stroke) => cloneStroke(stroke));
    if (strokesSnapshot.length === 0) return false;

    const nextPresent = present.filter((stroke) => !selectedIds.has(stroke.id));
    if (nextPresent.length === present.length) return false;

    commitPresent(nextPresent);
    clearSelection();
    set({
      strokesSnapshot,
      pasteCount: 0,
      lastPasteIds: [],
    });
    return true;
  },

  pasteFromClipboard: () => {
    const { strokesSnapshot, pasteCount } = get();
    if (strokesSnapshot.length === 0) return false;

    const { present, commitPresent } = useHistoryStore.getState();
    const { setSelection } = useShapeEditorStore.getState();
    const nextPasteCount = pasteCount + 1;
    const offset = PASTE_OFFSET_STEP * nextPasteCount;

    const pastedStrokes = strokesSnapshot.map((stroke) => ({
      ...cloneStroke(stroke),
      id: createStrokeId(),
      points: stroke.points.map((point) => ({
        ...point,
        x: point.x + offset,
        y: point.y + offset,
      })),
    }));
    const pastedIds = pastedStrokes.map((stroke) => stroke.id);

    commitPresent([...present, ...pastedStrokes]);
    setSelection(pastedIds, pastedIds[pastedIds.length - 1] ?? null);
    set({
      pasteCount: nextPasteCount,
      lastPasteIds: pastedIds,
    });
    return true;
  },

  hasData: () => get().strokesSnapshot.length > 0,
}));

export const useClipboardHasData = () => useClipboardStore((state) => state.strokesSnapshot.length > 0);
