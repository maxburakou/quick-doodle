import { StrokePoint } from "@/types";

export interface CanvasPointerPayload {
  point: StrokePoint;
  shiftKey: boolean;
  altKey: boolean;
}
