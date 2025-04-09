import { useEffect } from "react";

export const usePointerEvents = (stopDrawing: () => void) => {
  useEffect(() => {
    const handleEvent = () => stopDrawing();

    window.addEventListener("blur", handleEvent);
    window.addEventListener("pointerup", handleEvent);

    return () => {
      window.removeEventListener("blur", handleEvent);
      window.removeEventListener("pointerup", handleEvent);
    };
  }, [stopDrawing]);
};
