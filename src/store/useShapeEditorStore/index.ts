import { create } from "zustand";
import { ShapeEditorState } from "./types";
import {
  applySessionTransform,
  getStrokeBounds,
  getStrokeRotation,
  hasStrokeTransformChanged,
  replaceStrokeById,
} from "./helpers";

export const useShapeEditorStore = create<ShapeEditorState>((set, get) => ({
  selectedStrokeId: null,
  session: null,

  selectStroke: (selectedStrokeId) => set({ selectedStrokeId }),

  startTransform: ({ stroke, handle, pointer }) => {
    const normalizedStroke = {
      ...stroke,
      isShiftPressed: undefined,
    };
    const initialBounds = getStrokeBounds(normalizedStroke);
    const initialRotation = getStrokeRotation(normalizedStroke);

    set({
      selectedStrokeId: stroke.id,
      session: {
        strokeId: stroke.id,
        handle,
        startPointer: pointer,
        initialStroke: normalizedStroke,
        draftStroke: normalizedStroke,
        initialBounds,
        initialRotation,
        startPointerAngle:
          handle === "rotate"
            ? Math.atan2(
                pointer.y - (initialBounds.y + initialBounds.height / 2),
                pointer.x - (initialBounds.x + initialBounds.width / 2)
              )
            : undefined,
      },
    });
  },

  updateTransform: (pointer, options) => {
    const { session } = get();
    if (!session) return;

    const draftStroke = applySessionTransform(
      session,
      pointer,
      options?.shiftKey ?? false
    );

    set({
      session: {
        ...session,
        draftStroke,
      },
    });
  },

  commitTransform: (present, commitPresent) => {
    const { session } = get();
    if (!session) return;

    if (hasStrokeTransformChanged(session.initialStroke, session.draftStroke)) {
      const nextPresent = replaceStrokeById(present, session.draftStroke);
      commitPresent(nextPresent);
    }

    set({
      selectedStrokeId: session.draftStroke.id,
      session: null,
    });
  },

  cancelTransform: () => set({ session: null }),

  clearSelection: () =>
    set({
      selectedStrokeId: null,
      session: null,
    }),
}));

export const useSelectedStrokeId = () =>
  useShapeEditorStore((state) => state.selectedStrokeId);
export const useShapeTransformSession = () =>
  useShapeEditorStore((state) => state.session);
export const useSelectStroke = () => useShapeEditorStore((state) => state.selectStroke);
export const useStartShapeTransform = () =>
  useShapeEditorStore((state) => state.startTransform);
export const useUpdateShapeTransform = () =>
  useShapeEditorStore((state) => state.updateTransform);
export const useCommitShapeTransform = () =>
  useShapeEditorStore((state) => state.commitTransform);
export const useCancelShapeTransform = () =>
  useShapeEditorStore((state) => state.cancelTransform);
export const useClearShapeSelection = () =>
  useShapeEditorStore((state) => state.clearSelection);
