import {
  ShapeEditorSession,
  Stroke,
  StrokePoint,
  TransformHandle,
} from "@/types";

export interface ShapeEditorState {
  selectedStrokeIds: string[];
  primarySelectedStrokeId: string | null;
  session: ShapeEditorSession | null;
  setSelection: (ids: string[], primaryId?: string | null) => void;
  toggleSelection: (id: string) => void;
  startTransform: (params: {
    stroke: Stroke;
    handle: TransformHandle;
    pointer: StrokePoint;
  }) => void;
  startGroupMove: (params: { strokes: Stroke[]; pointer: StrokePoint }) => void;
  updateTransform: (pointer: StrokePoint, options?: { shiftKey?: boolean }) => void;
  updateGroupMove: (pointer: StrokePoint) => void;
  commitTransform: () => void;
  commitGroupMove: () => void;
  cancelTransform: () => void;
  clearSelection: () => void;
}
