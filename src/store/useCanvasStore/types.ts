import { CanvasBackground } from "@/types";

export interface CanvasState {
  background: CanvasBackground;
  setBackground: (background: CanvasBackground) => void;
  toggleBackground: () => void;
}
