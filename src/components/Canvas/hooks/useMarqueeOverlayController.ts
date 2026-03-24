import { useCallback, useMemo, useState } from "react";
import { ShapeBounds } from "@/types";

export interface MarqueeOverlayApi {
  setActiveBounds: (bounds: ShapeBounds | null) => void;
  fadeOutBounds: (bounds: ShapeBounds) => void;
  clear: () => void;
}

export const useMarqueeOverlayController = () => {
  const [bounds, setBounds] = useState<ShapeBounds | null>(null);
  const [isActive, setIsActive] = useState(false);

  const setActiveBounds = useCallback((bounds: ShapeBounds | null) => {
    if (!bounds) {
      setBounds(null);
      setIsActive(false);
      return;
    }
    setBounds(bounds);
    setIsActive(true);
  }, []);

  const clear = useCallback(() => {
    setBounds(null);
    setIsActive(false);
  }, []);

  const fadeOutBounds = useCallback((bounds: ShapeBounds) => {
    setBounds(bounds);
    setIsActive(false);
  }, []);

  const overlayApi = useMemo<MarqueeOverlayApi>(
    () => ({
      setActiveBounds,
      fadeOutBounds,
      clear,
    }),
    [clear, fadeOutBounds, setActiveBounds]
  );

  return {
    bounds,
    isActive,
    overlayApi,
  };
};
