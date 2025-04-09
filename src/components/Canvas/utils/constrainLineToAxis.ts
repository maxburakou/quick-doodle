import { StrokePoint } from "@/types";

export const constrainLineToAxis = (
  start: StrokePoint,
  end: StrokePoint,
  angleSnap: number = 45
): StrokePoint => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  const angle = Math.atan2(dy, dx);
  const distance = Math.hypot(dx, dy);

  const snappedAngle =
    (Math.round((angle * 180) / Math.PI / angleSnap) * angleSnap * Math.PI) /
    180;

  const x = start.x + distance * Math.cos(snappedAngle);
  const y = start.y + distance * Math.sin(snappedAngle);

  return {
    x,
    y,
    pressure: end.pressure,
  };
};
