import { StrokePoint } from "@/types";

const DIAGRAM_SNAP_INCREMENT_DEG = 90;
const MAX_DIAGRAM_SNAP_DELTA_DEG = 3;
const MAX_ENDPOINT_SHIFT_PX = 8;

const radiansToDegrees = (radians: number): number => (radians * 180) / Math.PI;

const normalizeAngleDelta = (deltaDeg: number): number => {
  let normalized = deltaDeg;
  while (normalized > 180) normalized -= 360;
  while (normalized <= -180) normalized += 360;
  return normalized;
};

export interface AngleSnapIntent {
  shouldSnap: boolean;
  angleDeg: number;
  snappedAngleDeg: number;
  deltaDeg: number;
  endpointShiftPx: number;
  snapIncrementDeg: number;
  maxDeltaDeg: number;
  maxEndpointShiftPx: number;
}

export const getAngleSnapIntent = (
  start: StrokePoint,
  end: StrokePoint
): AngleSnapIntent => {
  const angleDeg = radiansToDegrees(Math.atan2(end.y - start.y, end.x - start.x));
  const snappedAngleDeg =
    Math.round(angleDeg / DIAGRAM_SNAP_INCREMENT_DEG) *
    DIAGRAM_SNAP_INCREMENT_DEG;
  const deltaDeg = Math.abs(normalizeAngleDelta(angleDeg - snappedAngleDeg));
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const endpointShiftPx =
    2 * length * Math.sin((deltaDeg * Math.PI) / 180 / 2);

  return {
    shouldSnap:
      deltaDeg <= MAX_DIAGRAM_SNAP_DELTA_DEG &&
      endpointShiftPx <= MAX_ENDPOINT_SHIFT_PX,
    angleDeg,
    snappedAngleDeg,
    deltaDeg,
    endpointShiftPx,
    snapIncrementDeg: DIAGRAM_SNAP_INCREMENT_DEG,
    maxDeltaDeg: MAX_DIAGRAM_SNAP_DELTA_DEG,
    maxEndpointShiftPx: MAX_ENDPOINT_SHIFT_PX,
  };
};
