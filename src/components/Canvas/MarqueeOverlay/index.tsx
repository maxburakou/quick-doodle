import { memo, useMemo } from "react";
import type { CSSProperties, FC } from "react";
import { ShapeBounds } from "@/types";
import "./styles.css";

interface MarqueeOverlayProps {
  isVisible: boolean;
  bounds: ShapeBounds | null;
  isActive: boolean;
}

const toBoxStyle = (bounds: ShapeBounds): CSSProperties => ({
  transform: `translate3d(${bounds.x}px, ${bounds.y}px, 0)`,
  width: bounds.width,
  height: bounds.height,
});

const MarqueeOverlayComponent: FC<MarqueeOverlayProps> = ({
  isVisible,
  bounds,
  isActive,
}) => {
  const boxStyle = useMemo(() => (bounds ? toBoxStyle(bounds) : null), [bounds]);

  if (!isVisible || !boxStyle) return null;

  return (
    <div className="marquee-overlay-layer" aria-hidden="true">
      <div
        className={`marquee-overlay-box ${isActive ? "--active" : ""}`}
        style={boxStyle}
      />
    </div>
  );
};

export const MarqueeOverlay = memo(MarqueeOverlayComponent);
