import { useCanvasStore } from "@/store";
import { CanvasBackground } from "@/types";

export function toggleBackground() {
  const { background, setBackground } = useCanvasStore.getState();
  const newBackground =
    background === CanvasBackground.Transparent
      ? CanvasBackground.Light
      : CanvasBackground.Transparent;
  setBackground(newBackground);
}
