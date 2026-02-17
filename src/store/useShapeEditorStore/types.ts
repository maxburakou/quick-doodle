import { Stroke, StrokePoint, TransformHandle, TransformSession } from "@/types";

export interface ShapeEditorState {
  selectedStrokeId: string | null;
  session: TransformSession | null;
  selectStroke: (id: string | null) => void;
  startTransform: (params: {
    stroke: Stroke;
    handle: TransformHandle;
    pointer: StrokePoint;
  }) => void;
  updateTransform: (pointer: StrokePoint, options?: { shiftKey?: boolean }) => void;
  commitTransform: (
    present: Stroke[],
    commitPresent: (nextPresent: Stroke[]) => void
  ) => void;
  cancelTransform: () => void;
  clearSelection: () => void;
}
