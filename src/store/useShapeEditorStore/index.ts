import { create } from "zustand";
import { ShapeEditorState } from "./types";
import {
  applySessionTransform,
  getStrokeBounds,
  getStrokeRotation,
  hasStrokeTransformChanged,
  moveStrokeIdsToEnd,
  replaceStrokeById,
} from "./helpers";
import { normalizeTextStroke } from "@/components/Canvas/utils/textGeometry";
import { GroupMoveSession, Stroke } from "@/types";

const translateStroke = (stroke: Stroke, dx: number, dy: number): Stroke => ({
  ...stroke,
  points: stroke.points.map((point) => ({
    ...point,
    x: point.x + dx,
    y: point.y + dy,
  })),
});

const buildStrokesById = (strokes: Stroke[]) =>
  strokes.reduce<Record<string, Stroke>>((acc, stroke) => {
    acc[stroke.id] = stroke;
    return acc;
  }, {});

export const useShapeEditorStore = create<ShapeEditorState>((set, get) => ({
  selectedStrokeIds: [],
  primarySelectedStrokeId: null,
  session: null,

  setSelection: (ids, primaryId = null) => {
    const uniqueIds = Array.from(new Set(ids));
    const normalizedPrimaryId =
      primaryId && uniqueIds.includes(primaryId)
        ? primaryId
        : uniqueIds[uniqueIds.length - 1] ?? null;
    set({
      selectedStrokeIds: uniqueIds,
      primarySelectedStrokeId: normalizedPrimaryId,
    });
  },

  toggleSelection: (id) =>
    set((state) => {
      const exists = state.selectedStrokeIds.includes(id);
      if (exists) {
        const nextIds = state.selectedStrokeIds.filter(
          (selectedId) => selectedId !== id
        );
        const nextPrimary =
          state.primarySelectedStrokeId === id
            ? nextIds[nextIds.length - 1] ?? null
            : state.primarySelectedStrokeId;

        return {
          selectedStrokeIds: nextIds,
          primarySelectedStrokeId: nextPrimary,
          session: null,
        };
      }

      const nextIds = [...state.selectedStrokeIds, id];
      return {
        selectedStrokeIds: nextIds,
        primarySelectedStrokeId: id,
        session: null,
      };
    }),

  startTransform: ({ stroke, handle, pointer }) => {
    const baseStroke = {
      ...stroke,
      isShiftPressed: undefined,
    };
    const normalizedStroke = normalizeTextStroke(baseStroke);
    const initialBounds = getStrokeBounds(normalizedStroke);
    const initialRotation = getStrokeRotation(normalizedStroke);

    set({
      selectedStrokeIds: [stroke.id],
      primarySelectedStrokeId: stroke.id,
      session: {
        type: "single",
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

  startGroupMove: ({ strokes, pointer }) => {
    if (strokes.length < 2) return;
    const strokeIds = strokes.map((stroke) => stroke.id);
    const initialStrokesById = buildStrokesById(strokes);
    const session: GroupMoveSession = {
      type: "groupMove",
      strokeIds,
      startPointer: pointer,
      initialStrokesById,
      draftStrokesById: initialStrokesById,
    };

    set({
      selectedStrokeIds: strokeIds,
      primarySelectedStrokeId: strokeIds[strokeIds.length - 1] ?? null,
      session,
    });
  },

  updateTransform: (pointer, options) => {
    const { session } = get();
    if (!session || session.type !== "single") return;

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

  updateGroupMove: (pointer) => {
    const { session } = get();
    if (!session || session.type !== "groupMove") return;

    const dx = pointer.x - session.startPointer.x;
    const dy = pointer.y - session.startPointer.y;
    const nextDraftStrokesById = Object.entries(session.initialStrokesById).reduce<
      Record<string, Stroke>
    >((acc, [id, stroke]) => {
      acc[id] = translateStroke(stroke, dx, dy);
      return acc;
    }, {});

    set({
      session: {
        ...session,
        draftStrokesById: nextDraftStrokesById,
      },
    });
  },

  commitTransform: (present, commitPresent) => {
    const { session } = get();
    if (!session || session.type !== "single") return;

    if (hasStrokeTransformChanged(session.initialStroke, session.draftStroke)) {
      const replacedPresent = replaceStrokeById(present, session.draftStroke);
      const nextPresent = moveStrokeIdsToEnd(replacedPresent, [session.draftStroke.id]);
      commitPresent(nextPresent);
    }

    set({
      selectedStrokeIds: [session.draftStroke.id],
      primarySelectedStrokeId: session.draftStroke.id,
      session: null,
    });
  },

  commitGroupMove: (present, commitPresent) => {
    const { session } = get();
    if (!session || session.type !== "groupMove") return;

    const hasChanges = session.strokeIds.some((id) => {
      const initialStroke = session.initialStrokesById[id];
      const draftStroke = session.draftStrokesById[id];
      if (!initialStroke || !draftStroke) return false;
      return hasStrokeTransformChanged(initialStroke, draftStroke);
    });

    if (hasChanges) {
      const replacedPresent = present.map((stroke) => {
        const draftStroke = session.draftStrokesById[stroke.id];
        return draftStroke ? { ...draftStroke } : stroke;
      });
      const nextPresent = moveStrokeIdsToEnd(replacedPresent, session.strokeIds);
      commitPresent(nextPresent);
    }

    set((state) => ({
      selectedStrokeIds: state.selectedStrokeIds,
      primarySelectedStrokeId:
        state.primarySelectedStrokeId ??
        state.selectedStrokeIds[state.selectedStrokeIds.length - 1] ??
        null,
      session: null,
    }));
  },

  cancelTransform: () => set({ session: null }),

  clearSelection: () =>
    set({
      selectedStrokeIds: [],
      primarySelectedStrokeId: null,
      session: null,
    }),
}));

export const useSelectedStrokeIds = () =>
  useShapeEditorStore((state) => state.selectedStrokeIds);
export const usePrimarySelectedStrokeId = () =>
  useShapeEditorStore((state) => state.primarySelectedStrokeId);
export const useShapeTransformSession = () =>
  useShapeEditorStore((state) => state.session);
export const useSetShapeSelection = () =>
  useShapeEditorStore((state) => state.setSelection);
export const useToggleShapeSelection = () =>
  useShapeEditorStore((state) => state.toggleSelection);
export const useStartShapeTransform = () =>
  useShapeEditorStore((state) => state.startTransform);
export const useStartShapeGroupMove = () =>
  useShapeEditorStore((state) => state.startGroupMove);
export const useUpdateShapeTransform = () =>
  useShapeEditorStore((state) => state.updateTransform);
export const useUpdateShapeGroupMove = () =>
  useShapeEditorStore((state) => state.updateGroupMove);
export const useCommitShapeTransform = () =>
  useShapeEditorStore((state) => state.commitTransform);
export const useCommitShapeGroupMove = () =>
  useShapeEditorStore((state) => state.commitGroupMove);
export const useCancelShapeTransform = () =>
  useShapeEditorStore((state) => state.cancelTransform);
export const useClearShapeSelection = () =>
  useShapeEditorStore((state) => state.clearSelection);
