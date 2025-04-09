import { StrokePoint } from "@/types";

export interface AutoSizeTextareaProps {
  point: StrokePoint | null;
  clearPoint: () => void;
}
